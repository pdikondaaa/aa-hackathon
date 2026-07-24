"""Memory storage path configuration."""
import os
from pathlib import Path
from typing import Literal

MemoryKind = Literal[
    "user_history",
    "conversation_memory",
    "user_preferences",
    "collective_intelligence",
    "post_history",
]

_KIND_FILES = {
    "user_history":          "user_history.md",
    "conversation_memory":   "conversation_memory.md",
    "user_preferences":      "user_preferences.md",
    "collective_intelligence": "collective_intelligence.md",
    "post_history":          "post_history.md",
}

GLOBAL_USER = "_global"
_DEFAULT_ROOT = Path(__file__).resolve().parents[3] / "var" / "memory"


def memory_root() -> Path:
    return Path(os.environ.get("AURA_MEMORY_DIR", str(_DEFAULT_ROOT)))


def user_memory_dir(user_id: str) -> Path:
    safe = (user_id or "anonymous").strip() or "anonymous"
    return memory_root() / safe


def memory_file(user_id: str, kind: MemoryKind) -> Path:
    return user_memory_dir(user_id) / _KIND_FILES[kind]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
