"""Read/write .md memory artifacts with atomic writes and in-process locking."""
from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import Dict

from .config import MemoryKind, GLOBAL_USER, ensure_dir, memory_file

_locks: Dict[str, threading.Lock] = {}
_guard = threading.Lock()


def _lock(path: Path) -> threading.Lock:
    key = str(path)
    lk = _locks.get(key)
    if lk is None:
        with _guard:
            lk = _locks.setdefault(key, threading.Lock())
    return lk


def read(user_id: str, kind: MemoryKind) -> str:
    path = memory_file(user_id, kind)
    try:
        return path.read_text(encoding="utf-8") if path.exists() else ""
    except OSError:
        return ""


def read_global(kind: MemoryKind) -> str:
    return read(GLOBAL_USER, kind)


def write(user_id: str, kind: MemoryKind, content: str) -> None:
    path = memory_file(user_id, kind)
    ensure_dir(path.parent)
    with _lock(path):
        fd, tmp = tempfile.mkstemp(prefix=".aura_", dir=str(path.parent))
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


def append(user_id: str, kind: MemoryKind, content: str) -> None:
    path = memory_file(user_id, kind)
    ensure_dir(path.parent)
    with _lock(path):
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(content)


def trim_to_last_lines(user_id: str, kind: MemoryKind, max_lines: int) -> None:
    text = read(user_id, kind)
    if not text:
        return
    lines = text.splitlines(keepends=True)
    if len(lines) > max_lines:
        write(user_id, kind, "".join(lines[-max_lines:]))
