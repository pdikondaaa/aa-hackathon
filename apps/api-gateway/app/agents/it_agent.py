from typing import List


def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


def it_agent(query: str) -> str:
    """IT Agent — retrieves answers from the vector DB."""
    chunks = _retrieve(query, top_k=5)

    if not chunks:
        return (
            f"I couldn't find IT information for '{query}' in the knowledge base. "
            "Please contact IT Support at helpdesk@company.com or call +1-800-IT-HELP."
        )

    return "\n\n".join(c["chunk_text"].strip() for c in chunks if c.get("chunk_text"))
