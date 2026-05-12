"""
Splits plain text into overlapping chunks for embedding.
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)


class TextChunker:
    """Wraps LangChain's RecursiveCharacterTextSplitter with platform-level config."""

    def __init__(self):
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
        )

    def chunk(self, text: str) -> list:
        """Split text and return a list of non-empty chunk strings."""
        if not text or not text.strip():
            return []
        chunks = self._splitter.split_text(text)
        non_empty = [c for c in chunks if c.strip()]
        logger.debug(f"Produced {len(non_empty)} chunks from {len(text)} characters")
        return non_empty
