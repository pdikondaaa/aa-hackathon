"""
Test suite for the escalation agent.

Tests:
  1. Static message — escalation_agent() always returns ESCALATION_MESSAGE
  2. Supervisor routing — any query containing "escalat" routes to escalation
  3. Escalation bypasses all other routing (highest priority)
  4. Non-escalation queries do NOT trigger escalation routing
  5. End-to-end response via supervisor

Run from api-gateway root:
    python -m pytest tests/test_escalation_agent.py -v
  or directly:
    python tests/test_escalation_agent.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


def _banner(title: str) -> None:
    print(f"\n{'='*60}\n  {title}\n{'='*60}")


# ---------------------------------------------------------------------------
# 1. Static message — always returns ESCALATION_MESSAGE regardless of input
# ---------------------------------------------------------------------------

def test_static_message() -> bool:
    _banner("1. escalation_agent() always returns static ESCALATION_MESSAGE")
    from app.agents.escalation_agent import escalation_agent, ESCALATION_MESSAGE

    ok = escalation_agent() == ESCALATION_MESSAGE
    icon = PASS if ok else FAIL
    print(f"  {icon} Returns exact ESCALATION_MESSAGE: {ok}")
    if ok:
        print(f"\n--- Message ---\n{ESCALATION_MESSAGE}\n--- end ---")
    return ok


# ---------------------------------------------------------------------------
# 2. Supervisor routing — "escalat" keyword always goes to escalation
# ---------------------------------------------------------------------------

def test_supervisor_routing() -> bool:
    _banner("2. Supervisor routing — escalation keyword override")
    from app.agents.supervisor_agent import _master

    cases = [
        ("I want to escalate my leave issue",              ["escalation"]),
        ("Please escalate this IT security incident",      ["escalation"]),
        ("Escalate my expense claim",                      ["escalation"]),
        ("This needs to be escalated to the PMO",          ["escalation"]),
        ("escalation needed for my project",               ["escalation"]),
        ("I am escalating this matter formally",           ["escalation"]),
    ]

    all_ok = True
    for query, expected in cases:
        routed = _master._route(query)
        ok = routed == expected
        icon = PASS if ok else FAIL
        print(f"  {icon} '{query[:55]}' → {routed}")
        if not ok:
            all_ok = False
    return all_ok


# ---------------------------------------------------------------------------
# 3. Non-escalation queries do NOT route to escalation
# ---------------------------------------------------------------------------

def test_no_false_positives() -> bool:
    _banner("3. Non-escalation queries do not trigger escalation routing")
    from app.agents.supervisor_agent import _master

    cases = [
        "What is the leave policy?",
        "How do I reset my VPN?",
        "Submit a ZOHO expense",
        "Who is the manager of Priya?",
        "Tell me about the company",
    ]

    all_ok = True
    for query in cases:
        routed = _master._route(query)
        is_escalation = routed == ["escalation"]
        icon = PASS if not is_escalation else FAIL
        print(f"  {icon} '{query[:55]}' → {routed}")
        if is_escalation:
            all_ok = False
    return all_ok


# ---------------------------------------------------------------------------
# 4. Full end-to-end response via supervisor
# ---------------------------------------------------------------------------

def test_end_to_end() -> bool:
    _banner("4. End-to-end: escalation query returns static message via supervisor")
    from app.agents.supervisor_agent import run_assistant
    from app.agents.escalation_agent import ESCALATION_MESSAGE

    query = "I want to escalate a harassment incident at the workplace"
    response = run_assistant(query)

    ok = response.strip() == ESCALATION_MESSAGE.strip()
    icon = PASS if ok else FAIL
    print(f"  {icon} Response matches ESCALATION_MESSAGE: {ok}")
    if not ok:
        print(f"\n--- Got ---\n{response[:300]}\n--- end ---")
    return ok


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    results = {
        "static_message":      test_static_message(),
        "supervisor_routing":  test_supervisor_routing(),
        "no_false_positives":  test_no_false_positives(),
        "end_to_end":          test_end_to_end(),
    }

    _banner("Summary")
    all_pass = True
    for name, passed in results.items():
        icon = PASS if passed else FAIL
        print(f"  {icon}  {name}")
        if not passed:
            all_pass = False

    print()
    if all_pass:
        print("All checks passed.")
    else:
        print("Some checks failed — see output above.")
        sys.exit(1)
