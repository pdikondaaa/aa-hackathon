"""
Quick smoke-test for the HR Deep Agent.

Run from the api-gateway directory:
    python -m app.agents.test_hr_deep_agent

Make sure your .env has OLLAMA_BASE_URL and OLLAMA_MODEL set.
If you don't have an embedding model, set OLLAMA_EMBED_MODEL or
the agent will fall back to keyword search automatically.
"""

import sys
import os

# Allow running directly without installing the package
# Add api-gateway/ to sys.path so `app` is importable when running directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from dotenv import load_dotenv
load_dotenv()

from app.agents.deep.config import DeepAgentConfig
from app.agents.deep.hr_deep_agent import HRDeepAgent

TEST_QUERIES = [
    "How many days of annual leave do I get per year?",
    "What is the maternity leave policy?",
    "How do I apply for sick leave?",
    "What health and dental benefits does the company offer?",
    "How does the quarterly performance review work?",
    "Can I split my paternity leave into two periods?",
]


def run_tests():
    print("=" * 70)
    print("  AURA HR Deep Agent — Smoke Test")
    print("=" * 70)

    config = DeepAgentConfig()
    print(f"\nConfig:")
    print(f"  LLM   : {config.llm.model} @ {config.llm.base_url}")
    print(f"  Embed : {config.embeddings.model} @ {config.embeddings.base_url}")
    print(f"  KB    : chunk_size={config.knowledge_base.chunk_size}, top_k={config.knowledge_base.top_k}")
    print()

    agent = HRDeepAgent(config)
    print(f"\nAgent mode: {agent.mode}\n")
    print("=" * 70)

    for i, query in enumerate(TEST_QUERIES, 1):
        print(f"\n[{i}/{len(TEST_QUERIES)}] Q: {query}")
        print("-" * 60)
        answer = agent.process_query(query)
        print(f"A: {answer}")
        print()

    print("=" * 70)
    print("  Test complete.")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
