"""
Generates dense vector embeddings using a HuggingFace sentence-transformer model.

The model is loaded once on first use (singleton pattern) to avoid reloading
the weights on every file processed within a single job run.
"""
from langchain_huggingface import HuggingFaceEmbeddings

from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)


class Embedder:
    """Wraps HuggingFaceEmbeddings with lazy initialization."""

    def __init__(self):
        self._model = None

    def _get_model(self) -> HuggingFaceEmbeddings:
        if self._model is None:
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            self._model = HuggingFaceEmbeddings(
                model_name=settings.EMBEDDING_MODEL,
                model_kwargs={"trust_remote_code": True},
            )
        return self._model

    def embed(self, texts: list) -> list:
        """Embed a list of text chunks. Returns a list of float vectors."""
        if not texts:
            return []
        vectors = self._get_model().embed_documents(texts)
        logger.debug(f"Generated {len(vectors)} embeddings (dim={len(vectors[0])})")
        return vectors

    def embed_query(self, text: str) -> list:
        """Embed a single query string for similarity search."""
        return self._get_model().embed_query(text)
