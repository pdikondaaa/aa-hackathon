import os
from dataclasses import dataclass, field


@dataclass
class LLMConfig:
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434"))
    model: str = field(default_factory=lambda: os.environ.get("OLLAMA_MODEL", "gpt-oss"))
    temperature: float = 0.1
    max_tokens: int = 2048


@dataclass
class EmbeddingsConfig:
    base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
    # Run: ollama pull nomic-embed-text  (or set OLLAMA_EMBED_MODEL to another model)
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
