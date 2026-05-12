"""
Text extraction from supported document types.

Each supported extension is handled by a LangChain community loader.
Returns plain text — never raw binary or LangChain Document objects —
so the rest of the pipeline stays format-agnostic.
"""
import os

from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    CSVLoader,
    UnstructuredWordDocumentLoader,
    UnstructuredPowerPointLoader,
    UnstructuredExcelLoader,
)

from utils.logging_config import get_logger

logger = get_logger(__name__)

_LOADER_MAP = {
    ".pdf":  PyPDFLoader,
    ".txt":  TextLoader,
    ".csv":  CSVLoader,
    ".docx": UnstructuredWordDocumentLoader,
    ".doc":  UnstructuredWordDocumentLoader,
    ".pptx": UnstructuredPowerPointLoader,
    ".xlsx": UnstructuredExcelLoader,
}


class TextExtractor:
    """Extracts plain text from a local file."""

    def extract(self, file_path: str, file_name: str) -> str:
        """
        Load file_path and return its full text content.
        Raises ValueError for unsupported extensions.
        Raises RuntimeError if extraction fails.
        """
        ext = os.path.splitext(file_name)[1].lower()
        loader_cls = _LOADER_MAP.get(ext)
        if not loader_cls:
            raise ValueError(f"Unsupported file extension: {ext} ({file_name})")

        logger.debug(f"Extracting text from {file_name} using {loader_cls.__name__}")
        try:
            docs = loader_cls(file_path).load()
        except Exception as exc:
            raise RuntimeError(f"Loader failed for {file_name}: {exc}") from exc

        if not docs:
            return ""

        text = "\n\n".join(
            doc.page_content for doc in docs if doc.page_content and doc.page_content.strip()
        )
        logger.debug(f"Extracted {len(text)} characters from {file_name}")
        return text

    @staticmethod
    def is_supported(file_name: str) -> bool:
        ext = os.path.splitext(file_name)[1].lower()
        return ext in _LOADER_MAP
