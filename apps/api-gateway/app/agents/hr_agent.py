from typing import Dict, List


def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


def _format_response(query: str, chunks: List[dict]) -> Dict:
    if not chunks:
        return {
            "answer": (
                f"I couldn't find HR information for '{query}' in the knowledge base. "
                "Please contact HR directly at hr@company.com for assistance."
            ),
            "sources": [],
        }

    answer_parts = []
    sources = []

    for i, chunk in enumerate(chunks, 1):
        text = chunk.get("chunk_text", "").strip()
        if text:
            answer_parts.append(text)

        sources.append({
            "index": i,
            "file_name": chunk.get("file_name", "Unknown source"),
            "source_url": chunk.get("source_url") or "",
            "similarity": round(chunk.get("similarity", 0) * 100),
        })

    return {
        "answer": "\n\n".join(answer_parts),
        "sources": sources,
    }


def hr_agent(query: str) -> str:
    """HR Agent — retrieves answers from the vector DB."""
    chunks = _retrieve(query, top_k=5)
    result = _format_response(query, chunks)
    return result["answer"]
