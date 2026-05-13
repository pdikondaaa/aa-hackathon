from typing import List

_llm = None


def _get_llm():
    global _llm
    if _llm is not None:
        return _llm
    try:
        from langchain_ollama import ChatOllama
        from app.agents.working.config import LLMConfig
        cfg = LLMConfig()
        _llm = ChatOllama(
            base_url=cfg.base_url,
            model=cfg.model,
            temperature=0.1,
            num_predict=cfg.max_tokens,
        )
        print("[OrgAgent] LLM ready")
    except Exception as exc:
        print(f"[OrgAgent] LLM unavailable ({exc})")
    return _llm


def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


def org_agent(query: str) -> str:
    """Org Agent — retrieves answers from the vector DB and synthesizes with LLM."""
    chunks = _retrieve(query, top_k=5)
    if not chunks:
        return "I couldn't find specific information for your query. Please contact info@company.com."

    context = "\n\n".join(
        f"[{c.get('document_name', 'Company Document')}]\n{c['chunk_text'].strip()}"
        for c in chunks if c.get("chunk_text")
    )

    llm = _get_llm()
    if llm:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage
            from app.agents.working.personalities import ORG_PERSONALITY
            messages = [
                SystemMessage(content=ORG_PERSONALITY + f"\n\n**Company Information:**\n{context}"),
                HumanMessage(content=query),
            ]
            return llm.invoke(messages).content
        except Exception as exc:
            print(f"[OrgAgent] LLM invoke error ({exc}); returning raw context")

    return "\n\n".join(c["chunk_text"].strip() for c in chunks if c.get("chunk_text"))
