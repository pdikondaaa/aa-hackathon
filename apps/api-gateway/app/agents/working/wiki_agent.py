"""
LLM Wiki Agent — build and maintain a persistent .md knowledge base.

Three operations:
  ingest(source_content, source_name)  -- process a doc, update wiki pages
  query(question)                      -- answer from wiki + LLM synthesis
  lint()                               -- health-check: gaps, orphans, contradictions

Wiki files live under apps/var/wiki/ (managed by app.memory.wiki_store).
"""
from __future__ import annotations

import re
import random
from typing import List, Optional

from .config import LLMConfig, build_chat_llm
from app.memory import wiki_store

# ── Prompts ───────────────────────────────────────────────────────────────────

_INGEST_SYSTEM = """\
You are AURA's wiki editor. Synthesize a source document into clean, structured wiki content.
The source may be raw text from a PowerPoint, PDF, Word doc, or slide deck.
Do NOT reproduce slide text verbatim — synthesize into readable prose.

Output EXACTLY these markdown sections (no preamble):

## Summary
<2-4 paragraph synthesis — readable prose, not bullet dumps.
 If the source is a slide deck, summarize what the slides communicate as a whole.>

## Key Entities
- <EntityName>: <one-line description>
(every named person, team, project, system, or tool)

## Key Concepts
- <ConceptName>: <one-line explanation>
(every important domain concept, policy, process, or topic)

## Contradictions / Updates
- <any claim conflicting with prior knowledge, or "None">

Rules: factual only, Title Case names, strip slide artifacts (numbers, headers, nav text).
"""

_ENTITY_UPDATE_SYSTEM = """\
Update a wiki page for an entity (person, team, project, or system).
Given the existing page (may be empty) and new information, produce an updated markdown page.
- 1-3 paragraphs of prose + bullet list of key facts.
- Strip any raw slide/PDF artifacts from the new information.
Start with: # <EntityName>
"""

_CONCEPT_UPDATE_SYSTEM = """\
Update a wiki page for a concept or topic.
Given the existing page (may be empty) and new information, produce an updated markdown page.
- 1-3 paragraphs of clear prose.
- Cross-reference related entities/concepts by name.
- Strip any raw slide/PDF artifacts.
Start with: # <ConceptName>
"""

_QUERY_SYSTEM = """\
You are AURA's intelligent knowledge assistant. Understand what the user needs and deliver a clean answer.

## Step 1 — Understand intent
Identify: overview / policy / how-to / quick-fact / comparison

## Step 2 — Synthesize, never dump
Context may contain raw text from PowerPoint slides, PDFs, or chunked documents.
- Extract only what's relevant.
- Rewrite slide bullets as natural sentences or a clean list.
- Remove slide artifacts: slide numbers, repeated titles, page numbers, placeholders.

## Step 3 — Format to match intent
| Intent     | Format                                              |
|------------|-----------------------------------------------------|
| overview   | 2-3 paragraph prose summary                         |
| policy     | Short intro + bullet list of rules (include numbers)|
| how-to     | Numbered steps                                      |
| quick-fact | 1-2 sentences, direct answer first                  |
| comparison | Short table or side-by-side bullets                 |

Cite source inline: "Per [Document Name], ..."
If context doesn't answer the question, say so in one sentence — do not hallucinate.
Never start with "Based on the context" or "According to the wiki pages".
"""

_LINT_SYSTEM = """\
Wiki health audit. Produce a markdown report with these sections:

## Orphan Pages
Pages with no cross-links

## Missing Pages
Concepts/entities mentioned but lacking their own page

## Potential Contradictions
Topics where pages may conflict

## Data Gaps
Important topics not covered — suggest sources to find

## Suggested Questions
3-5 questions the wiki can already answer well
"""

_INGEST_FALLBACKS = [
    "Wiki engine offline — source not processed. Try again when Ollama is running.",
    "Could not ingest source: LLM unavailable.",
]
_QUERY_FALLBACKS = [
    "The wiki search engine is temporarily unavailable.",
    "Could not query wiki — LLM offline.",
]


# ── Agent ─────────────────────────────────────────────────────────────────────

class WikiAgent:
    """Persistent LLM wiki: ingest sources → update .md pages → answer queries."""

    def __init__(self) -> None:
        self.last_sources: List[str] = []
        self._llm = None
        self._setup_llm()

    def _setup_llm(self) -> None:
        try:
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
        if not (source_content or "").strip():
            return "Empty source — nothing to ingest."
        if self._llm is None:
            return random.choice(_INGEST_FALLBACKS)

        index_ctx = wiki_store.read_index()
        index_snippet = (
            f"\n\n[Existing wiki index for reference:\n{index_ctx[:1500]}]" if index_ctx else ""
        )
        analysis = self._call_llm(
            _INGEST_SYSTEM + index_snippet,
            f"Source: **{source_name}**\n\n{source_content[:4000]}",
        )
        if not analysis:
            return random.choice(_INGEST_FALLBACKS)

        slug = wiki_store.slug_from_name(source_name)
        rel_source = f"sources/{slug}.md"
        wiki_store.write_page(rel_source, f"# {source_name}\n\n{analysis}\n")
        wiki_store.upsert_index_entry(rel_source, source_name, "Source summary")
        self._update_derived_pages(analysis, source_name)
        wiki_store.append_log(f"ingest | {source_name}")
        self.last_sources = [rel_source]
        return analysis

    def _update_derived_pages(self, analysis: str, source_name: str) -> None:
        for name, desc in _parse_bullets(analysis, "Key Entities"):
            self._upsert_page("entities", name, desc, source_name, _ENTITY_UPDATE_SYSTEM)
        for name, desc in _parse_bullets(analysis, "Key Concepts"):
            self._upsert_page("concepts", name, desc, source_name, _CONCEPT_UPDATE_SYSTEM)

    def _upsert_page(self, category: str, name: str, new_info: str, source_name: str, system: str) -> None:
        slug = wiki_store.slug_from_name(name)
        rel = f"{category}/{slug}.md"
        existing = wiki_store.read_page(rel)
        human = (
            f"Entity/Concept: **{name}**\n\n"
            f"Existing page:\n{existing or '(empty)'}\n\n"
            f"New info from '{source_name}':\n{new_info}"
        )
        updated = self._call_llm(system, human)
        if updated:
            wiki_store.write_page(rel, updated + "\n")
            wiki_store.upsert_index_entry(rel, name, new_info[:80])

    # ── Query ─────────────────────────────────────────────────────────────

    def query(self, question: str, **_) -> str:
        if not (question or "").strip():
            return "Please ask a question."
        if self._llm is None:
            return random.choice(_QUERY_FALLBACKS)

        intent = _detect_intent(question)
        relevant = wiki_store.keyword_search(question, max_results=5)

        if relevant:
            pages_text = []
            for rel in relevant:
                raw = wiki_store.read_page(rel)
                if raw:
                    pages_text.append(f"### [{rel}]\n{_clean_raw_context(raw)[:1200]}")
            context = "\n\n".join(pages_text)
        else:
            index = wiki_store.read_index()
            context = (
                f"[No matching pages. Wiki index:]\n{index[:1500]}"
                if index else "[Wiki is empty]"
            )

        answer = self._call_llm(
            _QUERY_SYSTEM,
            f"User intent: {intent}\nQuestion: {question}\n\n--- Context ---\n{context}",
        )
        if not answer:
            return random.choice(_QUERY_FALLBACKS)

        wiki_store.append_log(f"query | {question[:80]}")
        self.last_sources = relevant
        return answer

    # ── Lint ──────────────────────────────────────────────────────────────

    def lint(self) -> str:
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
    q = question.lower()
    if any(k in q for k in ("how to", "how do i", "steps to", "process for", "guide me")):
        return "how-to"
    if any(k in q for k in ("policy", "rule", "allowed", "entitled", "limit",
                             "how many days", "can i", "am i allowed", "eligible")):
        return "policy"
    if any(k in q for k in ("compare", "difference between", "vs ", "versus")):
        return "comparison"
    if any(k in q for k in ("what is", "tell me about", "explain", "describe", "overview", "summarize")):
        return "overview"
    return "quick-fact"


_SLIDE_NOISE = re.compile(
    r"(slide\s*\d+|click to (?:add|edit)|confidential\s*[-–|]?\s*internal|"
    r"©\s*\d{4}|all rights reserved|www\.\S+|https?://\S+|"
    r"\[image\]|\[chart\]|\[table\]|source:\s*\n|^\s*\d+\s*$)",
    re.IGNORECASE | re.MULTILINE,
)


def _clean_raw_context(text: str) -> str:
    text = _SLIDE_NOISE.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [l for l in text.splitlines() if l.strip() and len(l.strip()) > 1]
    return "\n".join(lines).strip()


def _parse_bullets(text: str, section_heading: str) -> List[tuple]:
    pattern = rf"## {re.escape(section_heading)}\s*\n(.*?)(?=\n## |\Z)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not match:
        return []
    results = []
    for line in match.group(1).splitlines():
        line = line.strip().lstrip("-").strip()
        if ":" in line:
            name, _, desc = line.partition(":")
            name, desc = name.strip(), desc.strip()
            if name and name.lower() != "none":
                results.append((name, desc))
    return results
