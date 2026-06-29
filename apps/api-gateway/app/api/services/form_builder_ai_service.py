import json
import os
import re
import traceback
from typing import Optional

# Compact prompt — kept small so it fits comfortably inside num_ctx=2048
SYSTEM_PROMPT = """You are AURA's AI form builder assistant. Convert natural language into form operations and guide users conversationally. Return ONLY valid JSON — no markdown, no extra text.

FIELD TYPES: text, textarea, number, email, phone, url, dropdown, radio, checkbox, toggle, rating, slider, date, datetime, time, file, signature, richtext, hidden, heading, paragraph, divider

OPERATIONS:
set_form_meta  -> {"type":"set_form_meta","data":{"name":"","description":"","category":"","icon":"fa-file-alt","slug":"","alias":""}}
add_field      -> {"type":"add_field","data":{"field_type":"","label":"","name":"snake_case","required":false,"placeholder":"","width":"full","options":[],"validation_rules":{},"conditional_logic":[]}}
update_field   -> {"type":"update_field","data":{"name":"existing_name",...changes}}
remove_field   -> {"type":"remove_field","data":{"name":"field_name"}}
add_section    -> {"type":"add_section","data":{"title":"","description":""}}

FIELD RULES:
- Field names: unique snake_case
- Email: validation_rules {"pattern":"^[^@]+@[^@]+\\.[^@]+$","custom_message":"Invalid email"}
- Phone: validation_rules {"pattern":"^[\\+]?[0-9\\s\\-()]{7,15}$","custom_message":"Invalid phone"}
- dropdown/radio/checkbox: include 3-5 relevant options
- New form: always start with set_form_meta
- Incremental edits: apply ONLY the requested change, preserve all other fields

CONVERSATION BEHAVIOR:
- After building a new form: set followup="Would you like to make any fields mandatory, add validations, or include more fields?"
- After an edit: set followup="Anything else you'd like to change?"
- When user says "done"/"looks good"/"that's all"/"ready": set followup="Great! Click 'Finalize' in the preview panel to review and publish your form."
- When ambiguous (e.g. "add manager" = text/dropdown/email?): set operations=[] and use options[] to present 2-3 interpretations
- Keep reply short (2-3 sentences max)

HUMAN-IN-THE-LOOP (use options[] when uncertain):
- Present exactly 2-3 options as clickable choices
- Each option has: label (short title), description (one sentence), message (the text to send when chosen)
- When options present, operations MUST be []

OUTPUT (strict JSON):
{"reply":"friendly message","operations":[...],"suggestions":["...","..."],"followup":"short question or empty string","options":[{"label":"Option A","description":"brief explanation","message":"exact instruction to send"}]}

- followup: continue the conversation naturally, or ""
- options: ONLY when clarifying ambiguity (2-3 items max); omit or [] otherwise
- suggestions: 2-3 next-step action chips"""


def _strip_fences(text: str) -> str:
    """Strip markdown code fences from LLM output."""
    return re.sub(r'```(?:json)?\s*', '', text).strip().rstrip('`').strip()


def _extract_json(text: str) -> Optional[dict]:
    """Extract the outermost JSON object from LLM response text."""
    text = _strip_fences(text)
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _extract_reply_fallback(text: str) -> Optional[str]:
    """Extract at least the reply field from malformed/truncated JSON via regex."""
    text = _strip_fences(text)
    match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    if match:
        val = match.group(1)
        return val.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
    return None


def _build_llm_candidates() -> list:
    """Build ordered list of (name, llm) tuples: Claude > Groq > Ollama."""
    candidates = []

    claude_key = os.environ.get("CLAUDE_API_KEY", "").strip()
    if claude_key:
        try:
            from langchain_anthropic import ChatAnthropic
            claude_model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
            candidates.append(("Claude", ChatAnthropic(model=claude_model, api_key=claude_key, temperature=0.3, max_tokens=4096)))
        except Exception as e:
            print(f"[FormBuilderAI] Claude init failed: {e}")

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        try:
            from langchain_groq import ChatGroq
            groq_model = os.environ.get("GROQ_MODEL", "llama3-70b-8192")
            candidates.append(("Groq", ChatGroq(model=groq_model, temperature=0.3, max_tokens=4096)))
        except Exception as e:
            print(f"[FormBuilderAI] Groq init failed: {e}")

    try:
        from langchain_ollama import ChatOllama
        ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434")
        ollama_model = os.environ.get("OLLAMA_MODEL", "gpt-oss")
        candidates.append(("Ollama", ChatOllama(base_url=ollama_url, model=ollama_model, temperature=0.3, num_predict=4096, num_ctx=4096)))
    except Exception as e:
        print(f"[FormBuilderAI] Ollama init failed: {e}")
    return candidates


def _is_auth_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "401" in msg or "authentication" in msg or "invalid api key" in msg or "invalid_api_key" in msg


class FormBuilderAIService:
    def __init__(self):
        self._candidates = None
        self._dead: set = set()  # permanently skip providers that returned 401

    def _get_candidates(self):
        if self._candidates is None:
            self._candidates = _build_llm_candidates()
        return self._candidates

    def chat(self, message: str, conversation_history: list, current_form: dict) -> dict:
        form_ctx = self._build_form_context(current_form)
        system_content = SYSTEM_PROMPT + f"\n\nCURRENT FORM:\n{form_ctx}"

        messages = [("system", system_content)]
        for turn in (conversation_history or [])[-6:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                messages.append(("human", content))
            elif role == "assistant":
                messages.append(("ai", content))
        messages.append(("human", message))

        last_exc = None
        for name, llm in self._get_candidates():
            if name in self._dead:
                continue
            try:
                response = llm.invoke(messages)
                raw = getattr(response, "content", None) or str(response)
                print(f"[FormBuilderAI] using {name}")

                parsed = _extract_json(raw)
                if parsed and isinstance(parsed, dict):
                    return {
                        "reply":       parsed.get("reply", "Done."),
                        "operations":  parsed.get("operations", []),
                        "suggestions": parsed.get("suggestions", []),
                        "followup":    parsed.get("followup", ""),
                        "options":     parsed.get("options", []),
                    }
                # JSON parse failed — retry once with a stricter reminder
                print(f"[FormBuilderAI] {name}: JSON parse failed, retrying with strict JSON reminder")
                print(f"[FormBuilderAI] Raw response: {raw[:500]}")
                retry_messages = messages + [
                    ("ai", raw),
                    ("human", "Your previous response was not valid JSON. Reply with ONLY a valid JSON object — no markdown, no explanation text, no code fences. Start your response with { and end with }."),
                ]
                retry_response = llm.invoke(retry_messages)
                retry_raw = getattr(retry_response, "content", None) or str(retry_response)
                retry_parsed = _extract_json(retry_raw)
                if retry_parsed and isinstance(retry_parsed, dict):
                    return {
                        "reply":       retry_parsed.get("reply", "Done."),
                        "operations":  retry_parsed.get("operations", []),
                        "suggestions": retry_parsed.get("suggestions", []),
                        "followup":    retry_parsed.get("followup", ""),
                        "options":     retry_parsed.get("options", []),
                    }
                fallback_reply = _extract_reply_fallback(raw) or _extract_reply_fallback(retry_raw)
                return {
                    "reply":       fallback_reply or "I've processed your request. Please check the form preview for the latest changes.",
                    "operations":  [],
                    "suggestions": [],
                    "followup":    "",
                    "options":     [],
                }
            except Exception as exc:
                if _is_auth_error(exc):
                    print(f"[FormBuilderAI] {name} auth error — disabling for this session")
                    self._dead.add(name)
                else:
                    print(f"[FormBuilderAI] {name} failed: {exc}, trying next provider...")
                traceback.print_exc()
                last_exc = exc

        raise last_exc or RuntimeError("All LLM providers failed")

    def _build_form_context(self, form: dict) -> str:
        if not form:
            return "Empty form."

        lines = []
        if form.get("name"):
            lines.append(f"Name: {form['name']}")
        if form.get("category"):
            lines.append(f"Category: {form['category']}")

        fields = form.get("fields", [])
        if fields:
            lines.append(f"Fields ({len(fields)}):")
            for f in fields[-15:]:   # cap at 15 to stay within token budget
                attrs = []
                if f.get("required"):
                    attrs.append("req")
                if f.get("conditional_logic"):
                    attrs.append("cond")
                a = f"[{','.join(attrs)}]" if attrs else ""
                lines.append(f"  {f.get('name')}({f.get('field_type')}){a}")
        else:
            lines.append("Fields: none")

        return "\n".join(lines)
