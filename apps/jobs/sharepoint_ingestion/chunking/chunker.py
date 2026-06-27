"""
Splits plain text into overlapping chunks for embedding.

Strategy per file type:
  PPTX  — one logical unit per slide  ([Slide N] markers from extractor)
  XLSX  — one logical unit per sheet  ([Sheet: X] markers from extractor)
  Other — detect section headings; split into sections, then character-chunk
          within each section with the heading prepended.

Prepending the nearest heading to every chunk gives the embedding model topic
context alongside the chunk content, which significantly improves retrieval
precision without changing the database schema.
"""
import re

from langchain_text_splitters import RecursiveCharacterTextSplitter

from config.settings import settings
from utils.logging_config import get_logger

logger = get_logger(__name__)


# ── Text cleaning ─────────────────────────────────────────────────────────────

_PAGE_MARKER_RE = re.compile(r'(?i)\bpage\s+\d+\s+of\s+\d+\b')
_BOILERPLATE_RE = re.compile(
    r'(?im)^\s*(confidential|internal use only|draft|for internal use|'
    r'proprietary and confidential|all rights reserved)\s*$'
)
_EXCESS_NEWLINES_RE = re.compile(r'\n{3,}')


def _clean(text: str) -> str:
    text = _PAGE_MARKER_RE.sub('', text)
    text = _BOILERPLATE_RE.sub('', text)
    text = _EXCESS_NEWLINES_RE.sub('\n\n', text)
    return text.strip()


# ── Section heading detection ─────────────────────────────────────────────────
#
# Matches lines that look like section headings:
#   ALL CAPS lines (≥ 8 chars)  — "LEAVE POLICY", "WORKING HOURS AND ATTENDANCE"
#   Numbered headings           — "1.", "2.3", "1.1.2)"
#   Named section markers       — "Section 3:", "Chapter 2 — Overview"

_HEADING_RE = re.compile(
    r'^('
    r'[A-Z][A-Z0-9 \-&/]{7,79}'                        # ALL CAPS, 8-80 chars
    r'|\d+(?:\.\d+)*[.)]\s+.{1,79}'                    # 1. or 1.1) numbered
    r'|(?:Section|Chapter|Part|Appendix)\s+\S.{0,69}'  # named sections
    r')$',
    re.MULTILINE,
)


def _split_into_sections(text: str) -> list:
    """
    Return list of (heading, body) tuples split at detected headings.
    Falls back to [("", text)] when no headings are found.
    """
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [("", text)]

    sections = []

    # Text before the first heading
    preamble = text[:matches[0].start()].strip()
    if preamble:
        sections.append(("", preamble))

    for i, match in enumerate(matches):
        heading = match.group().strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((heading, body))

    return sections if sections else [("", text)]


# ── PPTX / XLSX marker splitting ──────────────────────────────────────────────

_SLIDE_RE = re.compile(r'^\[Slide \d+\]$', re.MULTILINE)
_SHEET_RE = re.compile(r'^\[Sheet: .+?\]$', re.MULTILINE)


def _split_by_marker(text: str, pattern: re.Pattern) -> list:
    """Split on [Slide N] or [Sheet: X] markers; return (label, body) pairs."""
    matches = list(pattern.finditer(text))
    if not matches:
        return [("", text)]

    sections = []
    for i, match in enumerate(matches):
        label = match.group().strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((label, body))

    return sections if sections else [("", text)]


# ── Chunker ───────────────────────────────────────────────────────────────────

class TextChunker:
    """
    File-type-aware chunker that produces heading-enriched chunks.

    For every section (slide / sheet / heading block) the section label is
    prepended to each chunk string.  The rest of the pipeline (embedder, db)
    is unchanged — chunks are still plain strings.
    """

    def __init__(self):
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
        )

    def chunk(self, text: str, file_name: str = "") -> list:
        """
        Split text and return enriched chunk strings.

        Args:
            text:      Full extracted text of the document.
            file_name: Original filename; used to select the split strategy.
        """
        if not text or not text.strip():
            return []

        text = _clean(text)
        ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""

        if ext == "pptx":
            sections = _split_by_marker(text, _SLIDE_RE)
        elif ext in ("xlsx", "xls"):
            sections = _split_by_marker(text, _SHEET_RE)
        else:
            sections = _split_into_sections(text)

        chunks = []
        for heading, body in sections:
            for piece in self._splitter.split_text(body):
                piece = piece.strip()
                if not piece:
                    continue
                # Prepend heading so the embedding captures topic + content
                chunks.append(f"{heading}\n\n{piece}" if heading else piece)

        logger.debug(
            f"Produced {len(chunks)} chunks from {len(text)} chars "
            f"across {len(sections)} sections [{file_name or 'unknown'}]"
        )
        return chunks
