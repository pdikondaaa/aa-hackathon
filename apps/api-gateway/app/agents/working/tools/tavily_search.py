"""
Shared Tavily web-search tool.

Any agent in working/ can call `tavily_search(query)` to get live web results
as a plain string, ready to be injected into an LLM prompt as extra context.

Gracefully returns an empty string if:
  - TAVILY_API_KEY is not set
  - tavily-python is not installed
  - The API call fails
so agents always have a safe fallback.
"""
import os
from typing import Optional


def tavily_search(query: str, max_results: int = 3) -> str:
    """
    Run a Tavily web search and return results as a formatted string.

    Args:
        query: The search query.
        max_results: Number of results to return (default 3, keeps token cost low).

    Returns:
        Formatted search results string, or empty string if unavailable.
    """
    api_key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not api_key:
        return ""

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",        # "basic" uses 1 credit; "advanced" uses 2
            include_answer=True,         # Tavily's own AI-generated summary
        )

        parts = []

        # Include Tavily's own short answer if present
        if response.get("answer"):
            parts.append(f"**Web Summary:** {response['answer']}")

        # Include individual result snippets
        for i, result in enumerate(response.get("results", []), 1):
            title = result.get("title", "")
            content = result.get("content", "").strip()
            url = result.get("url", "")
            if content:
                parts.append(f"[{i}] {title}\n{content}\nSource: {url}")

        return "\n\n".join(parts)

    except ImportError:
        print("[TavilySearch] tavily-python not installed — run: pip install tavily-python")
        return ""
    except Exception as exc:
        print(f"[TavilySearch] Search failed ({exc})")
        return ""


def is_tavily_available() -> bool:
    """Returns True if Tavily is configured and the package is installed."""
    if not os.environ.get("TAVILY_API_KEY", "").strip():
        return False
    try:
        import tavily  # noqa: F401
        return True
    except ImportError:
        return False
