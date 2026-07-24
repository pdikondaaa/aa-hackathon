"""DB-backed context for deep queries -- reads from live messages/conversations tables."""
from __future__ import annotations

from typing import List


def _recent_turns(user_id: str, limit: int) -> List[str]:
    if not user_id:
        return []
    try:
        from app.api.config.db_config import get_db_connection
    except Exception:
        return []
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT m.content, COALESCE(m.agent_name,''), m.created_at
                    FROM messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE c.user_id = %s AND c.is_deleted = FALSE
                      AND m.role = 'assistant' AND m.status = 'done'
                    ORDER BY m.created_at DESC LIMIT %s
                    """,
                    (user_id, limit),
                )
                rows = cur.fetchall() or []
    except Exception as exc:
        print(f"[memory.db_tool] messages lookup failed: {exc}")
        return []
    out: List[str] = []
    for row in rows:
        content = (row[0] if isinstance(row, (list, tuple)) else row.get("content") or "").strip()
        agent = (row[1] if isinstance(row, (list, tuple)) else row.get("agent_name") or "").strip()
        ts = row[2] if isinstance(row, (list, tuple)) else row.get("created_at")
        if content:
            tag = f" ({agent})" if agent else ""
            snippet = content.replace("\n", " ")[:240]
            out.append(f"[{ts}] assistant{tag}: {snippet}")
    return out


def _vector_snippets(query: str, limit: int) -> List[str]:
    try:
        from app.rag.retriever import retrieve_chunks
        chunks = retrieve_chunks(query, top_k=limit) or []
    except Exception:
        return []
    out: List[str] = []
    for c in chunks:
        text = (c.get("chunk_text") or "").strip()
        doc = c.get("document_name") or "Document"
        if text:
            out.append(f"[{doc}]\n{text}")
    return out


def fetch_user_db_context(user_id: str, query: str, limit: int = 3) -> str:
    parts: List[str] = []
    turns = _recent_turns(user_id, limit)
    if turns:
        parts.append("Recent assistant turns:\n" + "\n".join(turns))
    snippets = _vector_snippets(query, limit)
    if snippets:
        parts.append("Doc snippets:\n" + "\n\n".join(snippets))
    return "\n\n".join(parts)
