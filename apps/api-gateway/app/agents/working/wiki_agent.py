"""
LLM Wiki Agent — build and maintain a persistent .md knowledge base.

Three operations:
  ingest(source_content, source_name)  -- process a doc, update wiki pages
  query(question)                      -- answer from wiki + LLM synthesis
  lint()                               -- health-check: gaps, orphans, contradictions

All wiki files live under var/wiki/ (managed by app.memory.wiki_store).
The LLM never retrieves from raw docs at query time; it reads the pre-compiled wiki.
"""
from __future__ import annotations

import re
from typing import List, Optional

from langchain_ollama import ChatOllama

from .config import LLMConfig
from app.memory import wiki_store

# ── Prompts ───────────────────────────────────────────────────────────────────

_INGEST_SYSTEM = """\
You are AURA's wiki editor. Your job: synthesize a source document into clean, structured wiki content.

The source may be raw text extracted from a PowerPoint presentation, PDF, Word document, or slide deck.
Do NOT reproduce slide text verbatim. Synthesize it into clear, readable prose.

Output EXACTLY the following markdown sections (no preamble, no extra text):

## Summary
<2-4 paragraph synthesis — written as readable prose, not bullet dumps.
 Extract the key information, purpose, and takeaways from the source.
 If the source is a slide deck, summarize what the slides communicate as a whole.>

## Key Entities
- <EntityName>: <one-line description of who/what this is>
(list every named person, team, project, system, or tool mentioned)

## Key Concepts
- <ConceptName>: <one-line explanation>
(list every important domain concept, policy, process, or topic)

## Contradictions / Updates
- <note any claim that conflicts with or updates prior knowledge, or write "None">

Rules:
- Be factual — only what the source says, no invention.
- Entity and concept names must be Title Case.
- Strip slide artifacts: slide numbers, repeated headers, navigation text, "Click to edit" placeholders.
- Each bullet must be one line.
"""

_ENTITY_UPDATE_SYSTEM = """\
You are updating a wiki page for an entity (person, team, project, or system).
Given the existing page (may be empty) and new information, produce an updated markdown page.
- 1-3 paragraphs of prose + a bullet list of key facts.
- Do not invent information not present in the inputs.
- Strip any raw slide/PDF artifacts from the new information before incorporating it.
Start the page with: # <EntityName>
"""

_CONCEPT_UPDATE_SYSTEM = """\
You are updating a wiki page for a concept or topic.
Given the existing page (may be empty) and new information, produce an updated markdown page.
- 1-3 paragraphs of clear prose.
- Do not invent information. Cross-reference related entities/concepts by name.
- Strip any raw slide/PDF artifacts from the new information before incorporating it.
Start the page with: # <ConceptName>
"""

_QUERY_SYSTEM = """\
You are AURA's intelligent knowledge assistant. Your job: understand what the user needs and deliver a clean, helpful answer.

## Step 1 — Understand the user's intent
Read the question and decide what kind of answer is needed:
- overview      → user wants a broad explanation of a topic
- policy        → user wants rules, limits, entitlements, or procedures
- how-to        → user wants step-by-step instructions
- quick-fact    → user wants a specific number, date, name, or yes/no
- comparison    → user wants two or more things contrasted

## Step 2 — Synthesize, never dump
The context may contain raw text from PowerPoint slides, PDFs, or chunked documents.
You MUST NOT reproduce this raw text. Instead:
- Extract only what is relevant to the question.
- Rewrite slide bullets as natural, complete sentences or a clean list.
- Remove slide artifacts: slide numbers, repeated titles, "Source:", navigation text, placeholders.
- Ignore content from the context that doesn't address the question.

## Step 3 — Format to match intent
| Intent      | Format                                                         |
|-------------|----------------------------------------------------------------|
| overview    | 2-3 paragraph prose summary                                    |
| policy      | Short intro + bullet list of key rules (include numbers/dates) |
| how-to      | Numbered steps                                                 |
| quick-fact  | 1-2 sentences, direct answer first                             |
| comparison  | Short table or side-by-side bullets                            |

Always cite the source inline where relevant: "Per [Document Name], ..."

## Rules
- If the context doesn't answer the question, say so in one sentence — do not hallucinate.
- Never start your answer with "Based on the context" or "According to the wiki pages".
- Keep it concise. Don't pad with summaries of what you just did.
"""

_LINT_SYSTEM = """\
You are a wiki health auditor. Review the wiki index and page list, then produce a markdown report with these sections:

## Orphan Pages
Pages with no cross-links (mention by name or path)

## Missing Pages
Concepts or entities mentioned in summaries but lacking their own page

## Potential Contradictions
Topics where different pages may conflict (be specific)

## Data Gaps
Important topics not yet covered — suggest what sources to find

## Suggested Questions
3-5 questions a user might ask that the wiki can already answer well

Keep each section to bullet points. Be specific, not generic.
"""

# ── Fallbacks ─────────────────────────────────────────────────────────────────

import random as _random

_INGEST_FALLBACKS = [
    "Wiki engine is offline — source not processed. Try again when Ollama is running.",
    "Could not ingest source: LLM unavailable.",
]
_QUERY_FALLBACKS = [
    "The wiki search engine is temporarily unavailable.",
    "Could not query wiki — LLM offline.",
]


def _pick(pool: List[str]) -> str:
    return _random.choice(pool)


# ── Agent ─────────────────────────────────────────────────────────────────────

class WikiAgent:
    """Persistent LLM wiki: ingest sources → update .md pages → answer queries."""

    def __init__(self) -> None:
        self.last_sources: List[str] = []
        self._llm: Optional[ChatOllama] = None
        self._setup_llm()

    def _setup_llm(self) -> None:
        try:
            from .config import build_chat_llm
            llm, url, model = build_chat_llm(LLMConfig(), temperature=0.15, num_predict=900)
            if llm is None:
                print("[WikiAgent] All Ollama endpoints unreachable — wiki queries unavailable")
                self._llm = None
                return
            self._llm = llm
            print(f"[WikiAgent] ready | endpoint={url} | model={model}")
        except Exception as exc:
            print(f"[WikiAgent] LLM setup failed: {exc}")
            self._llm = None

    def _call_llm(self, system: str, human: str) -> Optional[str]:
        if self._llm is None:
            return None
        try:
            resp = self._llm.invoke([("system", system), ("human", human)])
            return (getattr(resp, "content", None) or str(resp)).strip() or None
        except Exception as exc:
            print(f"[WikiAgent] LLM error: {exc}")
            return None

    # ── Ingest ────────────────────────────────────────────────────────────

    def ingest(self, source_content: str, source_name: str) -> str:
        """
        Process a source document:
          1. Write a summary page under sources/
          2. Create/update entity pages
          3. Create/update concept pages
          4. Update index + log
        Returns the LLM-generated analysis markdown.
        """
        if not (source_content or "").strip():
            return "Empty source — nothing to ingest."
        if self._llm is None:
            return _pick(_INGEST_FALLBACKS)

        # Provide existing index for contradiction detection
        index_ctx = wiki_store.read_index()
        index_snippet = (
            f"\n\n[Existing wiki index for reference:\n{index_ctx[:1500]}]"
            if index_ctx else ""
        )

        analysis = self._call_llm(
            _INGEST_SYSTEM + index_snippet,
            f"Source: **{source_name}**\n\n{source_content[:4000]}",
        )
        if not analysis:
            return _pick(_INGEST_FALLBACKS)

        # ── Write source summary page ──────────────────────────────────
        slug = wiki_store.slug_from_name(source_name)
        rel_source = f"sources/{slug}.md"
        wiki_store.write_page(rel_source, f"# {source_name}\n\n{analysis}\n")
        wiki_store.upsert_index_entry(rel_source, source_name, "Source summary")

        # ── Parse and update entity / concept pages ────────────────────
        self._update_derived_pages(analysis, source_name)

        wiki_store.append_log(f"ingest | {source_name}")
        self.last_sources = [rel_source]
        return analysis

    def _update_derived_pages(self, analysis: str, source_name: str) -> None:
        """Extract entity/concept lists from analysis and upsert their pages."""
        entities = _parse_bullets(analysis, "Key Entities")
        concepts = _parse_bullets(analysis, "Key Concepts")

        for name, desc in entities:
            self._upsert_page("entities", name, desc, source_name, _ENTITY_UPDATE_SYSTEM)

        for name, desc in concepts:
            self._upsert_page("concepts", name, desc, source_name, _CONCEPT_UPDATE_SYSTEM)

    def _upsert_page(
        self, category: str, name: str, new_info: str, source_name: str, system: str
    ) -> None:
        slug = wiki_store.slug_from_name(name)
        rel = f"{category}/{slug}.md"
        existing = wiki_store.read_page(rel)

        human = (
            f"Entity/Concept name: **{name}**\n\n"
            f"Existing page:\n{existing or '(empty — create from scratch)'}\n\n"
            f"New information from source '{source_name}':\n{new_info}"
        )
        updated = self._call_llm(system, human)
        if updated:
            wiki_store.write_page(rel, updated + "\n")
            wiki_store.upsert_index_entry(rel, name, new_info[:80])

    # ── Query ─────────────────────────────────────────────────────────────

    def query(self, question: str, **_) -> str:
        """Answer a question by searching the wiki and synthesising with the LLM."""
        if not (question or "").strip():
            return "Please ask a question."
        if self._llm is None:
            return _pick(_QUERY_FALLBACKS)

        intent = _detect_intent(question)

        relevant = wiki_store.keyword_search(question, max_results=5)
        if relevant:
            pages_text = []
            for rel in relevant:
                raw = wiki_store.read_page(rel)
                if raw:
                    cleaned = _clean_raw_context(raw)
                    pages_text.append(f"### [{rel}]\n{cleaned[:1200]}")
            context = "\n\n".join(pages_text)
        else:
            index = wiki_store.read_index()
            context = (
                f"[No directly matching wiki pages found. Wiki index for reference:]\n{index[:1500]}"
                if index else "[Wiki is empty — no relevant information available]"
            )

        human = (
            f"User intent: {intent}\n"
            f"Question: {question}\n\n"
            f"--- Context ---\n{context}"
        )
        answer = self._call_llm(_QUERY_SYSTEM, human)
        if not answer:
            return _pick(_QUERY_FALLBACKS)

        wiki_store.append_log(f"query | {question[:80]}")
        self.last_sources = relevant
        return answer

    # ── Lint ──────────────────────────────────────────────────────────────

    def lint(self) -> str:
        """Health-check the wiki. Returns a markdown audit report."""
        if self._llm is None:
            return "Wiki linter offline (LLM unavailable)."

        index = wiki_store.read_index()
        pages = wiki_store.list_pages()
        pages_list = "\n".join(f"- {p}" for p in pages[:120])

        report = self._call_llm(
            _LINT_SYSTEM,
            f"## Wiki index\n{index[:2000]}\n\n## All pages ({len(pages)} total)\n{pages_list}",
        )
        if not report:
            return "Lint failed — LLM error."

        wiki_store.append_log("lint | health check completed")
        return report


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_intent(question: str) -> str:
    """Classify the question into one of five intent buckets for the LLM hint."""
    q = question.lower()
    if any(k in q for k in ("how to", "how do i", "steps to", "process for", "guide me", "walk me")):
        return "how-to"
    if any(k in q for k in ("policy", "rule", "allowed", "entitled", "entitlement", "limit",
                             "how many days", "can i", "am i allowed", "eligible")):
        return "policy"
    if any(k in q for k in ("compare", "difference between", "vs ", "versus", "better")):
        return "comparison"
    if any(k in q for k in ("what is", "tell me about", "explain", "describe", "overview",
                             "summarize", "summary")):
        return "overview"
    # Default: likely a quick-fact or general lookup
    return "quick-fact"


# Patterns that appear in raw slide/PDF dumps but carry no information
_SLIDE_NOISE = re.compile(
    r"(slide\s*\d+|click to (?:add|edit)|confidential\s*[-–|]?\s*internal|"
    r"©\s*\d{4}|all rights reserved|www\.\S+|https?://\S+|"
    r"\[image\]|\[chart\]|\[table\]|source:\s*\n|^\s*\d+\s*$)",
    re.IGNORECASE | re.MULTILINE,
)


def _clean_raw_context(text: str) -> str:
    """Strip common slide/PDF artifacts from retrieved context before sending to LLM."""
    # Remove slide noise patterns
    text = _SLIDE_NOISE.sub("", text)
    # Collapse 3+ consecutive blank lines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Drop lines that are pure whitespace or a single punctuation character
    lines = [l for l in text.splitlines() if l.strip() and len(l.strip()) > 1]
    return "\n".join(lines).strip()


def _parse_bullets(text: str, section_heading: str) -> List[tuple]:
    """
    Extract (name, description) pairs from a '## Section' bullet list.
    Expected format:  - Name: description
    """
    pattern = rf"## {re.escape(section_heading)}\s*\n(.*?)(?=\n## |\Z)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not match:
        return []
    results = []
    for line in match.group(1).splitlines():
        line = line.strip().lstrip("-").strip()
        if ":" in line:
            name, _, desc = line.partition(":")
            name = name.strip()
            desc = desc.strip()
            if name and name.lower() != "none":
                results.append((name, desc))
    return results
