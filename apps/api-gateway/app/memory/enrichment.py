"""Per-message memory enrichment -- called after every assistant response."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

from . import md_store

_CONV_MAX_LINES = 200


def update_after_message(
    user_id: str,
    conversation_id: str,
    user_msg: str,
    assistant_msg: str,
    sources: Optional[Iterable[str]] = None,
    agent_name: str = "",
) -> None:
    """Append to post_history and update rolling conversation_memory. Never raises."""
    if not user_id:
        return
    try:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        agent_tag = f" ({agent_name})" if agent_name else ""
        src_line = ""
        if sources:
            cleaned = [s.strip() for s in sources if s and s.strip()]
            if cleaned:
                src_line = "\nSources: " + "; ".join(cleaned)

        post_block = (
            f"\n## {ts}{agent_tag}\n"
            f"**User:** {(user_msg or '').strip()}\n\n"
            f"**Assistant:** {(assistant_msg or '').strip()}\n"
            f"{src_line}\n"
        )
        md_store.append(user_id, "post_history", post_block)

        conv_line = (
            f"- [{ts}] user: {(user_msg or '').strip()[:240]}\n"
            f"- [{ts}] assistant{agent_tag}: {(assistant_msg or '').strip()[:240]}\n"
        )
        md_store.append(user_id, "conversation_memory", conv_line)
        md_store.trim_to_last_lines(user_id, "conversation_memory", _CONV_MAX_LINES)
    except Exception as exc:
        print(f"[memory.enrichment] failed for user={user_id}: {exc}")
