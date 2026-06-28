import os
from dataclasses import dataclass, field


def _use_claude() -> bool:
    return os.environ.get("USE_Claude_API_Key", "False").lower() in ("true", "1", "yes")


def _use_groq() -> bool:
    return os.environ.get("USE_Groq_API_Key", "False").lower() in ("true", "1", "yes")


@dataclass
class LLMConfig:
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434"))
    model: str = field(default_factory=lambda: os.environ.get("OLLAMA_MODEL", "gpt-oss"))
    groq_model: str = field(default_factory=lambda: os.environ.get("GROQ_MODEL", "llama3-70b-8192"))
    claude_model: str = field(default_factory=lambda: os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"))
    claude_api_key: str = field(default_factory=lambda: os.environ.get("CLAUDE_API_KEY", ""))
    temperature: float = 0.1
    max_tokens: int = 800
    num_ctx: int = 2048


def create_llm(temperature=None, max_tokens=None, num_ctx=None, cfg=None):
    """Return ChatAnthropic, ChatGroq, or ChatOllama based on env flags.

    Priority: USE_Claude_API_Key > USE_Groq_API_Key > Ollama (default)
    """
    if cfg is None:
        cfg = LLMConfig()
    temp = temperature if temperature is not None else cfg.temperature
    tokens = max_tokens if max_tokens is not None else cfg.max_tokens
    if _use_claude():
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=cfg.claude_model,
            api_key=cfg.claude_api_key,
            temperature=temp,
            max_tokens=tokens,
        )
    elif _use_groq():
        from langchain_groq import ChatGroq
        return ChatGroq(model=cfg.groq_model, temperature=temp, max_tokens=tokens)
    else:
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=cfg.base_url,
            model=cfg.model,
            temperature=temp,
            num_predict=tokens,
            num_ctx=num_ctx if num_ctx is not None else cfg.num_ctx,
        )


@dataclass
class EmbeddingsConfig:
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434"))
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
