"""
Funny agent -- light humour, small-talk, morale boosters.

No pgvector, no FAISS, no Tavily. Calls Ollama directly with the
FUNNY_PERSONALITY system prompt at high temperature for variety.
Fallback strings are randomised so an offline LLM never echoes the
same sentence on every turn.
"""
from __future__ import annotations

import random
from typing import List

from langchain_ollama import ChatOllama

from .config import LLMConfig
from .personalities import FUNNY_PERSONALITY

_LLM_DOWN_FALLBACKS = [
    "My comedy circuits are buffering. Try me again in a bit?",
    "My punchline is stuck in traffic. Give me a sec.",
    "I had a great joke but it timed out. Story of my life.",
    "The comedy server is on a coffee break. Catch me later?",
    "My wit's offline right now. Want to ask HR something serious instead?",
]
_EMPTY_FALLBACKS = [
    "I lost the punchline. Ask me again?",
    "My brain went blank on that one. Another try?",
    "Hmm, that one stumped me. Go again?",
]
_NO_INPUT_FALLBACKS = [
    "Say something and I'll try to be funny about it.",
    "Drop a word -- I'll riff on it.",
    "I'm here. Give me material to work with.",
]

_STYLE_NOTE = (
    "\n\nStyle for THIS reply: be concise (1-3 sentences max), "
    "vary your opening and joke shape each time, "
    "mirror the user's energy."
)


class FunnyAgent:
    """Witty companion -- mirrors BaseDeepAgent's public surface."""

    def __init__(self) -> None:
        self.last_sources: List[str] = []
        self._llm = None
        self._setup_llm()

    def _setup_llm(self) -> None:
        try:
            cfg = LLMConfig()
            self._llm = ChatOllama(
                base_url=cfg.base_url,
                model=cfg.model,
                temperature=0.95,
                top_p=0.95,
                num_predict=1024,
            )
        except Exception as exc:
            print(f"[FunnyAgent] LLM setup failed: {exc}")
            self._llm = None

    def process_query(self, query: str, user_id: str = "", **_) -> str:
        self.last_sources = []
        clean = (query or "").strip()
        if not clean:
            return random.choice(_NO_INPUT_FALLBACKS)
        if self._llm is None:
            return random.choice(_LLM_DOWN_FALLBACKS)
        messages = [
            ("system", str(FUNNY_PERSONALITY) + _STYLE_NOTE),
            ("human", clean),
        ]
        try:
            resp = self._llm.invoke(messages)
            content = (getattr(resp, "content", None) or str(resp)).strip()
            return content or random.choice(_EMPTY_FALLBACKS)
        except Exception as exc:
            print(f"[FunnyAgent] LLM error: {exc}")
            return random.choice(_LLM_DOWN_FALLBACKS)
