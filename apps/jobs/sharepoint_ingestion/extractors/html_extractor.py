"""
HTML extractor using BeautifulSoup.

Strips SharePoint chrome (navigation bars, toolbars, scripts, styles) and
returns clean plain text that is ready for chunking and embedding.

Handles:
  - SharePoint site pages (canvas-rendered HTML)
  - Playwright-captured full-page HTML
  - Any generic HTML fragment passed from the web scraper
"""

from __future__ import annotations

import re
from bs4 import BeautifulSoup, Tag

from utils.logging_config import get_logger

logger = get_logger(__name__)


# ── Tags that carry no readable content ──────────────────────────────────────

_STRIP_TAGS = frozenset({
    "script", "style", "noscript",
    "nav", "header", "footer", "aside",
    "form", "button", "input", "select", "textarea",
    "svg", "canvas", "iframe",
    "meta", "link", "base",
})


# ── CSS selectors for SharePoint-specific chrome ─────────────────────────────
# These elements exist in every SharePoint page but carry no knowledge content.

_CHROME_SELECTORS = [
    # Global nav / suite bar
    "#suiteBar",
    "#ms-designer-ribbon",
    "[data-sp-feature-tag='SuiteNavPlaceholder']",
    # Command bars and toolbars
    ".ms-CommandBar",
    ".ms-NavBar",
    ".ms-GlobalNavBar",
    ".od-TopBar",
    ".ms-FocusZone[data-automationid='CommandBar']",
    # Site headers / footers
    "[data-automation-id='SiteHeader']",
    "[data-automation-id='SiteFooter']",
    ".ms-SiteHeader",
    ".ms-siteheader",
    ".ms-spSitePageHeader",
    # Quick launch / left nav
    ".ms-nav",
    ".ms-QuickLaunch",
    # SharePoint page layout chrome
    "#sp-appBar",
    "#appAreaNotificationBar",
    ".sp-ntp-header",
]


class HtmlExtractor:
    """
    Converts raw HTML (SharePoint page or any HTML fragment) to plain text.

    Usage::

        extractor = HtmlExtractor()
        text = extractor.extract(html_string, page_title="HR Policies")
    """

    def extract(self, html: str, page_title: str = "") -> str:
        """
        Parse *html* and return clean plain text.

        Processing order:
          1. Remove SharePoint chrome via CSS selectors
          2. Remove non-content tags (script, style, nav …)
          3. Extract heading hierarchy
          4. Extract tables as TSV
          5. Extract bulleted/numbered lists
          6. Extract remaining body text
          7. Collapse excess whitespace

        Returns an empty string when no meaningful content is found.
        """
        if not html or not html.strip():
            return ""

        soup = BeautifulSoup(html, "lxml")

        # ── 1. Remove SharePoint chrome ───────────────────────────────────
        for selector in _CHROME_SELECTORS:
            for el in soup.select(selector):
                el.decompose()

        # ── 2. Remove non-content tags ────────────────────────────────────
        for tag_name in _STRIP_TAGS:
            for el in soup.find_all(tag_name):
                el.decompose()

        parts: list[str] = []

        # ── 3. Page title header ──────────────────────────────────────────
        if page_title:
            parts.append(f"Page: {page_title}")
            parts.append("=" * (len(page_title) + 6))

        # ── 4. Tables → TSV ───────────────────────────────────────────────
        for table in soup.find_all("table"):
            table_text = self._table_to_text(table)
            if table_text:
                parts.append("[Table]")
                parts.append(table_text)
            table.decompose()

        # ── 5. Lists → bullet text ────────────────────────────────────────
        for lst in soup.find_all(["ul", "ol"]):
            items = []
            for li in lst.find_all("li", recursive=False):
                item_text = li.get_text(separator=" ", strip=True)
                if item_text:
                    items.append(f"  • {item_text}")
            if items:
                parts.extend(items)
            lst.decompose()

        # ── 6. Headings (preserve hierarchy for chunker context) ──────────
        for h in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
            text = h.get_text(separator=" ", strip=True)
            if text:
                parts.append(text)
            h.decompose()

        # ── 7. Remaining body text ────────────────────────────────────────
        body_text = soup.get_text(separator="\n", strip=True)
        for line in body_text.splitlines():
            line = line.strip()
            if line:
                parts.append(line)

        # ── 8. Cleanup ────────────────────────────────────────────────────
        full_text = "\n".join(parts)
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)   # collapse blank lines
        full_text = re.sub(r"[ \t]{2,}", " ", full_text)    # collapse spaces
        full_text = full_text.strip()

        logger.debug(
            f"HTML extracted {len(full_text)} chars"
            f"{f' for «{page_title}»' if page_title else ''}"
        )
        return full_text

    @staticmethod
    def _table_to_text(table: Tag) -> str:
        """Convert an HTML <table> element to tab-separated plain text."""
        rows: list[str] = []
        for tr in table.find_all("tr"):
            cells = [
                cell.get_text(separator=" ", strip=True)
                for cell in tr.find_all(["th", "td"])
            ]
            row = "\t".join(cells)
            if row.strip():
                rows.append(row)
        return "\n".join(rows)
