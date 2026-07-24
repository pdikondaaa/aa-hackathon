"""MemoryClient -- single entry-point each agent uses to pull user context."""
from __future__ import annotations

from typing import List

from . import md_store
from .complexity import classify
from .db_tool import fetch_user_db_context

_MAX_BLOCK = 5000


def _trim(text: str, limit: int = 1200) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "\n... (truncated)"


class MemoryClient:
    def get_context(self, user_id: str, query: str) -> str:
        if not user_id:
            return ""
        depth = classify(query)
        parts: List[str] = []

        prefs = _trim(md_store.read(user_id, "user_preferences"), 600)
        if prefs:
            parts.append(f"### User preferences\n{prefs}")

        conv = _trim(md_store.read(user_id, "conversation_memory"), 1200)
        if conv:
            parts.append(f"### Recent conversation\n{conv}")

        if depth == "deep":
            hist = _trim(md_store.read(user_id, "user_history"), 1200)
            if hist:
                parts.append(f"### Long-term history\n{hist}")
            coll = _trim(md_store.read_global("collective_intelligence"), 800)
            if coll:
                parts.append(f"### Collective intelligence\n{coll}")
            db = _trim(fetch_user_db_context(user_id, query, limit=3), 1500)
            if db:
                parts.append(f"### DB context\n{db}")

        if not parts:
            return ""

        block = "<memory>\n" + "\n\n".join(parts) + "\n</memory>"
        if len(block) > _MAX_BLOCK:
            block = block[:_MAX_BLOCK] + "\n... (memory truncated)\n</memory>"
        return block
