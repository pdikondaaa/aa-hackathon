import os
import socket
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse


@dataclass
class LLMConfig:
    # Primary — Ollama Cloud (or any remote with optional auth)
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434"))
    model: str = field(default_factory=lambda: os.environ.get("OLLAMA_MODEL", "gpt-oss:120b-cloud"))
    api_key: str = field(default_factory=lambda: os.environ.get("OLLAMA_API_KEY", ""))

    # Fallback — ml01 on-prem (no auth)
    fallback_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_FALLBACK_URL", "http://ml01.alignedautomation.com:11434"))
    fallback_model: str = field(default_factory=lambda: os.environ.get("OLLAMA_FALLBACK_MODEL", "gpt-oss"))

    temperature: float = 0.1
    max_tokens: int = 2048


@dataclass
class EmbeddingsConfig:
    # Embeddings always run on ml01 (fallback) — stays local
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_FALLBACK_URL", os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434")))
    model: str = field(default_factory=lambda: os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text"))


@dataclass
class KnowledgeBaseConfig:
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 5


@dataclass
class DeepAgentConfig:
    llm: LLMConfig = field(default_factory=LLMConfig)
    embeddings: EmbeddingsConfig = field(default_factory=EmbeddingsConfig)
    knowledge_base: KnowledgeBaseConfig = field(default_factory=KnowledgeBaseConfig)


# ── Shared LLM factory ────────────────────────────────────────────────────────

def is_reachable(url: str, timeout: int = 5) -> bool:
    """TCP probe — works for http (port 11434) and https (port 443) URLs."""
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 11434)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def build_chat_llm(
    cfg: LLMConfig,
    temperature: Optional[float] = None,
    num_predict: Optional[int] = None,
):
    """
    Return (ChatOllama, url, model) trying primary first, then fallback.
    Returns (None, None, None) if both are unreachable.
    Primary uses OLLAMA_API_KEY bearer auth; fallback (ml01) has no auth.
    """
    from langchain_ollama import ChatOllama

    temp   = temperature  if temperature  is not None else cfg.temperature
    tokens = num_predict  if num_predict  is not None else cfg.max_tokens

    candidates = (
        (cfg.base_url,     cfg.model,         cfg.api_key),
        (cfg.fallback_url, cfg.fallback_model, ""),
    )

    for url, model, key in candidates:
        if not is_reachable(url):
            print(f"[LLMFactory] {url} unreachable, trying next...")
            continue
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        try:
            llm = ChatOllama(
                base_url=url,
                model=model,
                temperature=temp,
                num_predict=tokens,
                timeout=30,
                **({"client_kwargs": {"headers": headers}} if headers else {}),
            )
            print(f"[LLMFactory] connected → {url} | model={model}")
            return llm, url, model
        except Exception as exc:
            print(f"[LLMFactory] init failed at {url}: {exc}")

    return None, None, None
