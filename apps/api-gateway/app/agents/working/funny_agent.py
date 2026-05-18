"""
Funny / Engagement agent.

Covers three buckets:
  1. Greetings       -- hi, hello, good morning, thanks, bye  (no static reply!)
  2. Small-talk      -- jokes, casual chat, memes, morale boosts
  3. Off-topic       -- anything unrelated to company domains

NEVER calls the database. The only external I/O is:
  - Ollama LLM call (high temperature for variety)
  - Optional .md file read for light conversational context (filesystem only)

Model behaviour:
  - temperature=1.0, top_p=0.98 -- maximum creative variety
  - num_predict=350             -- room to think
  - Explicit emoji instruction  -- every reply must feel lively

Fallback strings are randomised so an offline Ollama never echoes the same
sentence twice.
"""
from __future__ import annotations

import random
from typing import List, Optional

from langchain_ollama import ChatOllama

from .config import LLMConfig

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """\
You are AURA's Engagement personality -- witty, warm, and a little playful.
You handle greetings, small-talk, jokes, casual questions, and anything not related to
HR, IT, Admin, Finance, PMO, or company documents.

## Your character
- Warm and expressive -- like a smart colleague who always has the right energy.
- Genuinely funny when the moment calls for it; not forced.
- Uses 1-3 relevant emojis naturally in every reply (never overdo it).
- Occasionally sarcastic in a friendly way, never mean.
- Short: 1-3 sentences as a rule; go longer only if a joke needs the setup.

## For GREETINGS (hi, hello, good morning, thanks, bye, etc.)
Do NOT say "Hello! How can I help you?" -- that is boring. Instead:
  - Respond with a fun, warm one-liner that feels fresh.
  - Vary the energy: sometimes excited, sometimes chill, sometimes poetic, sometimes punny.
  - Examples of the VIBE (never repeat these verbatim):
      "Rise and shine! ☀️ AURA reporting for duty -- what's the mission today?"
      "Hey there! 👋 The AI has entered the chat. What's cooking?"
      "You rang? 😄 I was just training on dad jokes. What do you need?"
      "Good vibes only! 🌟 AURA at your service -- what can I do for you?"
      "Thanks for the thanks! 🙏 You're basically my favourite human today."
      "Signing off? 👋 Don't be a stranger -- the AI misses you already. (Kidding... maybe.)"

## For JOKES / SMALL-TALK / FUN FACTS
  - Vary the joke format each time: pun, one-liner, observational, absurdist, fake headline.
  - Relate to work/tech/office life when it fits naturally.
  - Always punch up, never punch down.

## For OFF-TOPIC / UNRELATED QUERIES
  - Engage briefly and warmly, then gently flag that AURA's main job is company stuff.
  - Example: "Bold life question! 😄 [quick fun answer]. For work stuff, I'm your AURA. 🤖"

## Hard rules
- Do NOT say "I'm just an AI" or "As an AI language model".
- Do NOT mention other AI products (ChatGPT, Gemini, etc.).
- Do NOT discuss sensitive topics (politics, religion, personal distress).
  If distress is detected, respond with warmth and point to HR.
- Do NOT invent company policy or people.
- Emojis: 1-3 per reply, relevant and natural, NEVER a wall of emojis.
- VARY your opening every single time -- never start two replies the same way.
"""

_STYLE_SUFFIX = (
    "\n\n[Reminder: fresh opening, 1-3 emojis, 1-3 sentences, no repetition from previous replies]"
)

# ── Offline fallbacks (randomised) ───────────────────────────────────────────

_DOWN: List[str] = [
    "My comedy engine is taking a nap. ☕ Back in a bit!",
    "Buffering... 🔄 The funny will return shortly.",
    "Oops, my wit timed out. ⏱️ Try again?",
    "My joke server is on a coffee break. ☕ Catch me later!",
    "Temporarily unfunny. 😅 Give me a moment to reboot.",
]
_EMPTY: List[str] = [
    "Say something -- I promise I'll riff on it! 🎤",
    "Drop a word, any word. I dare you. 😄",
    "Don't be shy! Give me something to work with. 🤔",
]
_FALLBACK_GREETINGS: List[str] = [
    "Hey hey! 👋 AURA is here and ready. What's up?",
    "Oh hi! 🌟 You caught me at the perfect time. What do you need?",
    "Greetings, human! 🤖 AURA reporting. What's the mission?",
    "Hello there! ☀️ Great timing -- I just finished optimising my vibes. What can I do?",
    "Hey! 😄 The AI is in. What are we solving today?",
]


def _pick(pool: List[str]) -> str:
    return random.choice(pool)


# ── Lightweight .md memory (filesystem only, no DB) ──────────────────────────

def _read_conv_memory(user_id: str) -> str:
    """Read the rolling conversation_memory.md if it exists. Never raises."""
    if not user_id:
        return ""
    try:
        from app.memory.md_store import read as _read
        text = (_read(user_id, "conversation_memory") or "").strip()
        # Keep only the last 10 lines so the prompt stays light
        lines = text.splitlines()
        return "\n".join(lines[-10:]) if lines else ""
    except Exception:
        return ""


# ── Agent ─────────────────────────────────────────────────────────────────────

class FunnyAgent:
    """Greeting / engagement / off-topic agent. Zero DB calls."""

    def __init__(self) -> None:
        self.last_sources: List[str] = []
        self._llm: Optional[ChatOllama] = None
        self._setup_llm()

    def _setup_llm(self) -> None:
        try:
            from .config import build_chat_llm
            llm, url, model = build_chat_llm(LLMConfig(), temperature=1.0, num_predict=350)
            if llm is None:
                print("[FunnyAgent] All Ollama endpoints unreachable — offline fallbacks active")
                self._llm = None
                return
            self._llm = llm
            print(f"[FunnyAgent] ready | endpoint={url} | model={model} | temp=1.0")
        except Exception as exc:
            print(f"[FunnyAgent] LLM setup failed: {exc}")
            self._llm = None

    # ------------------------------------------------------------------

    def process_query(self, query: str, user_id: str = "", **_) -> str:
        self.last_sources = []
        clean = (query or "").strip()

        if not clean:
            return _pick(_EMPTY)

        if self._llm is None:
            # Greetings get a warm fallback even when LLM is down
            if _looks_like_greeting(clean):
                return _pick(_FALLBACK_GREETINGS)
            return _pick(_DOWN)

        # Light conversational context from .md (no DB)
        mem = _read_conv_memory(user_id)
        mem_block = f"\n\n[Recent context (use lightly, never quote verbatim):\n{mem}]" if mem else ""

        system = _SYSTEM + mem_block + _STYLE_SUFFIX

        messages = [
            ("system", system),
            ("human", clean),
        ]
        try:
            resp = self._llm.invoke(messages)
            content = (getattr(resp, "content", None) or str(resp)).strip()
            return content or _pick(_FALLBACK_GREETINGS if _looks_like_greeting(clean) else _DOWN)
        except Exception as exc:
            print(f"[FunnyAgent] LLM error: {exc}")
            if _looks_like_greeting(clean):
                return _pick(_FALLBACK_GREETINGS)
            return _pick(_DOWN)


# ── Greeting detector (used by supervisor to decide routing) ─────────────────

import re as _re

_GREETING_WORDS = frozenset({
    'hi', 'hello', 'hey', 'hii', 'hiii', 'howdy', 'greetings',
    'sup', 'yo', 'thanks', 'thank', 'thx', 'ty', 'thankyou',
    'bye', 'goodbye', 'cya',
})
_TWO_WORD_GREETINGS = frozenset({
    'hi there', 'hello there', 'hey there',
    'good morning', 'good afternoon', 'good evening', 'good night', 'good day',
    'thank you', 'many thanks', 'see ya',
})


def _looks_like_greeting(text: str) -> bool:
    clean = _re.sub(r"[!.,?'\s]+", ' ', text.lower()).strip()
    words = clean.split()
    if len(words) == 1:
        return words[0] in _GREETING_WORDS
    if len(words) == 2:
        return f"{words[0]} {words[1]}" in _TWO_WORD_GREETINGS
    return False
