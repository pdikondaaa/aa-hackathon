import json
import os
import re
from difflib import SequenceMatcher
from typing import Optional

_GREETINGS_FILE = os.path.join(os.path.dirname(__file__), "greetings.json")


def _load_categories() -> list:
    with open(_GREETINGS_FILE, encoding="utf-8") as f:
        return json.load(f)["categories"]


# Loaded once at import time
_CATEGORIES = _load_categories()


def _normalize(text: str) -> str:
    """Lowercase and strip punctuation for clean keyword matching."""
    return re.sub(r"[!.,?;:]+", "", text.lower()).strip()


def get_greeting_response(query: str) -> Optional[str]:
    """
    Returns a contextually appropriate response if the query is a greeting/small-talk,
    or None if it should be routed to a domain agent.

    Matching order:
      1. Exact keyword match (after normalizing punctuation/case)
      2. Fuzzy word match for short queries (≤ 4 words, ≥ 0.75 similarity)
    """
    q_clean = _normalize(query.strip())
    words = [w for w in q_clean.split() if w]

    for cat in _CATEGORIES:
        keywords: list = cat.get("keywords", [])
        fuzzy_targets: list = cat.get("fuzzy_targets", [])
        response: str = cat["response"]

        # 1. Exact keyword match
        if q_clean in keywords:
            return response

        # 2. Fuzzy match — only for short inputs (pure small-talk)
        if len(words) <= 4 and fuzzy_targets:
            if any(
                any(SequenceMatcher(None, word, t).ratio() >= 0.75 for t in fuzzy_targets)
                for word in words
                if len(word) >= 2
            ):
                return response

    return None
