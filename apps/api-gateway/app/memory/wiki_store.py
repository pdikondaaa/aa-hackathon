"""Filesystem operations for the LLM Wiki — persistent, structured .md knowledge base.

Wiki layout (under var/wiki/):
  index.md          — catalog of all pages (title, path, one-line summary)
  log.md            — append-only operation log
  sources/          — one page per ingested source document
  entities/         — people, teams, projects, systems
  concepts/         — topic / domain concept pages
  synthesis/        — cross-cutting analysis and comparison pages
"""
from __future__ import annotations

import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

_locks: Dict[str, threading.Lock] = {}
_guard = threading.Lock()

_DEFAULT_WIKI_ROOT = Path(__file__).resolve().parents[3] / "var" / "wiki"


def wiki_root() -> Path:
    return Path(os.environ.get("AURA_WIKI_DIR", str(_DEFAULT_WIKI_ROOT)))


def _lock(path: Path) -> threading.Lock:
    key = str(path)
    lk = _locks.get(key)
    if lk is None:
        with _guard:
            lk = _locks.setdefault(key, threading.Lock())
    return lk


def _ensure(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


# ── Page I/O ──────────────────────────────────────────────────────────────────

def read_page(rel_path: str) -> str:
    """Read a wiki page by its path relative to wiki_root(). Returns '' if missing."""
    path = wiki_root() / rel_path
    try:
        return path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError:
        return ""


def write_page(rel_path: str, content: str) -> None:
    """Atomically write a wiki page."""
    path = wiki_root() / rel_path
    _ensure(path.parent)
    with _lock(path):
        fd, tmp = tempfile.mkstemp(prefix=".wiki_", dir=str(path.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(content)
            os.replace(tmp, path)
        except Exception:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise


def page_exists(rel_path: str) -> bool:
    return (wiki_root() / rel_path).exists()


# ── Index ─────────────────────────────────────────────────────────────────────

def read_index() -> str:
    return read_page("index.md")


def upsert_index_entry(rel_path: str, title: str, summary: str) -> None:
    """Add or update a one-line entry in index.md."""
    index = read_index()
    entry_line = f"- [{title}]({rel_path}) — {summary}"

    lines = index.splitlines()
    # Replace existing line for this path if present
    new_lines = [l for l in lines if f"]({rel_path})" not in l]
    new_lines.append(entry_line)

    if not index:
        header = "# AURA Wiki Index\n\n_Auto-maintained by WikiAgent. Edit with care._\n\n"
        write_page("index.md", header + "\n".join(new_lines) + "\n")
    else:
        write_page("index.md", "\n".join(new_lines) + "\n")


# ── Log ───────────────────────────────────────────────────────────────────────

def append_log(entry: str) -> None:
    """Append a timestamped entry to log.md."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    line = f"\n## [{ts}] {entry}\n"
    path = wiki_root() / "log.md"
    _ensure(path.parent)
    with _lock(path):
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line)


# ── Discovery ─────────────────────────────────────────────────────────────────

def list_pages(category: Optional[str] = None) -> List[str]:
    """Return rel_paths of all .md pages, optionally filtered by category directory."""
    root = wiki_root()
    base = root / category if category else root
    if not base.exists():
        return []
    return sorted(
        str(p.relative_to(root)).replace("\\", "/")
        for p in base.rglob("*.md")
        if p.name not in ("index.md", "log.md")
    )


def keyword_search(query: str, max_results: int = 6) -> List[str]:
    """Return rel_paths of pages whose content best matches the query tokens."""
    tokens = set(query.lower().split())
    if not tokens:
        return []
    scored: List[tuple] = []
    for rel in list_pages():
        content = read_page(rel).lower()
        score = sum(1 for t in tokens if t in content)
        if score > 0:
            scored.append((score, rel))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:max_results]]


def slug_from_name(name: str) -> str:
    """Convert a human name/title to a safe filename stem."""
    import re
    return re.sub(r"[^\w\-]", "_", name.lower()).strip("_") or "page"
