"""Query depth classifier: simple (.md only) vs deep (.md + DB)."""
from __future__ import annotations

import re
from typing import Literal

Depth = Literal["simple", "deep"]

_PAST_REF = re.compile(
    r"\b(last\s+time|earlier|previously|before|yesterday|history|recap|as\s+we\s+discussed)\b",
    re.IGNORECASE,
)
_REASONING = re.compile(
    r"\b(why|how\s+come|explain|compare|difference\s+between|pros\s+and\s+cons|trade.?offs?)\b",
    re.IGNORECASE,
)
_WH = re.compile(r"\b(what|when|where|who|why|how|which)\b", re.IGNORECASE)


def classify(query: str) -> Depth:
    q = (query or "").strip()
    if not q:
        return "simple"
    if len(q.split()) > 20:
        return "deep"
    if _PAST_REF.search(q):
        return "deep"
    if _REASONING.search(q):
        return "deep"
    if len(_WH.findall(q)) >= 2:
        return "deep"
    return "simple"
