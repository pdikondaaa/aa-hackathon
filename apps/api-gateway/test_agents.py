"""
AURA Agent Test Console
Run from the api-gateway directory:
    python test_agents.py
"""
import sys
import os
import io
import time
from contextlib import redirect_stdout, redirect_stderr

# Make `app` importable
sys.path.insert(0, os.path.dirname(__file__))

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# ── Enable ANSI colours on Windows ──────────────────────────────────────────
os.system("")

R   = "\033[0m"
B   = "\033[1m"
DIM = "\033[2m"
CY  = "\033[96m"
GR  = "\033[92m"
YL  = "\033[93m"
RD  = "\033[91m"
MG  = "\033[95m"
BL  = "\033[94m"
ORG = "\033[38;5;208m"  # orange

# ── Helpers ──────────────────────────────────────────────────────────────────

def hr(char="─", width=66):
    print(DIM + char * width + R)

def title(text):
    print(f"\n{B}{MG}{'─'*66}{R}")
    pad = (66 - len(text)) // 2
    print(f"{B}{MG}{' ' * pad}{text}{R}")
    print(f"{B}{MG}{'─'*66}{R}\n")

def ok(msg):   print(f"  {GR}✓{R}  {msg}")
def warn(msg): print(f"  {YL}⚠{R}  {msg}")
def err(msg):  print(f"  {RD}✗{R}  {msg}")

# ── Agent definitions ─────────────────────────────────────────────────────────

AGENT_DEFS = [
    {
        "key":   "1",
        "label": "Master (Auto)",
        "desc":  "LLM routes query → calls one or many agents → synthesises response + sources",
        "color": MG,
        "tag":   "master",
    },
    {
        "key":   "2",
        "label": "HR",
        "desc":  "HR Policies + HR Docs  (leave, benefits, POSH, GHI, HROne …)",
        "color": BL,
        "tag":   "slave",
    },
    {
        "key":   "3",
        "label": "IT",
        "desc":  "IT Policies + IT Docs  (MFA, VPN, password, laptop, OneDrive …)",
        "color": CY,
        "tag":   "slave",
    },
    {
        "key":   "4",
        "label": "Admin",
        "desc":  "Admin Policies + Docs  (travel, cab/ORIX, parking, workplace …)",
        "color": YL,
        "tag":   "slave",
    },
    {
        "key":   "5",
        "label": "PMO",
        "desc":  "PMO Docs  (onboarding process, project overviews, best practices …)",
        "color": GR,
        "tag":   "slave",
    },
    {
        "key":   "6",
        "label": "Finance",
        "desc":  "Finance Policies  (ZOHO expenses, TDS, declarations …)",
        "color": ORG,
        "tag":   "slave",
    },
    {
        "key":   "7",
        "label": "Org",
        "desc":  "Company structure, mission, general policies",
        "color": DIM,
        "tag":   "slave",
    },
]

# ── Agent loader ──────────────────────────────────────────────────────────────

def _try_load(label, loader_fn):
    print(f"  Loading {B}{label}{R} … ", end="", flush=True)
    try:
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            result = loader_fn()
        print(f"{GR}ready{R}")
        return result
    except Exception as exc:
        print(f"{RD}failed{R}  {DIM}({exc}){R}")
        return None


def load_all_agents():
    print(f"\n{B}Initialising agents …{R}\n")

    # ── Master agent (supervisor) ────────────────────────────────────────────
    def load_master():
        from app.agents.supervisor_agent import run_assistant
        # MasterAgent LLM routing + slave registry are set up at import time.
        # Slaves load lazily on first query — no pre-warm needed here.
        return {"fn": run_assistant, "agent": None, "mode_source": None}

    # ── Individual slave agents (lazy deep-agent warm-up, no dummy query) ───
    def load_hr():
        import app.agents.hr_agent as m
        m._get_deep()           # triggers document loading without running a query
        return {"fn": m.hr_agent, "agent": m._hr_deep, "mode_source": "hr"}

    def load_it():
        import app.agents.it_agent as m
        m._get_deep()
        return {"fn": m.it_agent, "agent": m._it_deep, "mode_source": "it"}

    def load_admin():
        import app.agents.admin_agent as m
        m._get_deep()
        return {"fn": m.admin_agent, "agent": m._admin_deep, "mode_source": "admin"}

    def load_pmo():
        from app.agents.working.pmo.pmo_deep_agent import PMODeepAgent
        agent = PMODeepAgent()
        return {"fn": agent.process_query, "agent": agent, "mode_source": "pmo"}

    def load_finance():
        from app.agents.working.finance.finance_deep_agent import FinanceDeepAgent
        agent = FinanceDeepAgent()
        return {"fn": agent.process_query, "agent": agent, "mode_source": "finance"}

    def load_org():
        from app.agents.org_agent import org_agent
        return {"fn": org_agent, "agent": None, "mode_source": None}

    loaders = {
        "1": ("Master (Auto)", load_master),
        "2": ("HR",            load_hr),
        "3": ("IT",            load_it),
        "4": ("Admin",         load_admin),
        "5": ("PMO",           load_pmo),
        "6": ("Finance",       load_finance),
        "7": ("Org",           load_org),
    }

    fns = {}
    for key, (label, loader) in loaders.items():
        result = _try_load(label, loader)
        if result:
            fns[key] = result

    return fns

# ── Menu ──────────────────────────────────────────────────────────────────────

def show_menu(agent_fns):
    print()
    hr()
    print(f"  {B}Select an agent{R}  {DIM}(q = quit, r = reload all){R}")
    hr()
    for d in AGENT_DEFS:
        status = f"{GR}●{R}" if d["key"] in agent_fns else f"{RD}○{R}"
        tag    = f" {MG}[master]{R}" if d["tag"] == "master" else f" {DIM}[slave]{R}"
        print(
            f"  {status}  {d['color']}{B}{d['key']}{R}"
            f"  {B}{d['label']:<14}{R}"
            f"{tag}  {DIM}{d['desc']}{R}"
        )
    hr()

# ── Query / response ──────────────────────────────────────────────────────────

def run_query(key, entry, agent_fns):
    defn  = next((d for d in AGENT_DEFS if d["key"] == key), None)
    label = defn["label"] if defn else key
    color = defn["color"] if defn else ""
    fn    = entry["fn"]
    agent = entry["agent"]  # deep agent object, may be None

    print(f"\n  {color}{B}[{label}]{R}  Type your question {DIM}(blank line = back to menu){R}")
    hr("─", 66)

    while True:
        try:
            query = input(f"  {B}>{R} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return

        if not query:
            return

        print(f"\n  {DIM}Thinking …{R}", flush=True)
        t0 = time.perf_counter()
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                response = fn(query)
        except Exception as exc:
            elapsed = time.perf_counter() - t0
            err(f"Agent error after {elapsed:.1f}s: {exc}")
            print()
            continue

        elapsed = time.perf_counter() - t0

        # Collect extra info
        mode    = getattr(agent, "mode", None)
        sources = getattr(agent, "last_sources", [])

        # ── Print response ────────────────────────────────────────────────
        print()
        hr("─", 66)

        # Header line: label + time + mode badge
        mode_badge = f"  {DIM}mode:{GR}{mode}{R}" if mode else ""
        print(f"  {color}{B}[{label}]{R}  {DIM}{elapsed:.1f}s{R}{mode_badge}")

        hr("─", 66)
        for line in response.splitlines():
            print(f"  {line}")
        hr("─", 66)

        # Sources footer (only for slave agents; master already embeds them)
        if sources and key != "1":
            print(f"  {DIM}📄 Sources used: {', '.join(sources)}{R}")
            hr("─", 66)

        print()
        print(f"  {DIM}Ask another question or press Enter to go back to menu{R}")
        hr("─", 66)


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    title("AURA  —  Agent Test Console")

    agent_fns = load_all_agents()

    if not agent_fns:
        err("No agents loaded. Check your .env and dependencies.")
        sys.exit(1)

    loaded = len(agent_fns)
    total  = len(AGENT_DEFS)
    status_color = GR if loaded == total else YL
    print(f"\n  {status_color}{B}{loaded}/{total}{R} agents ready.\n")

    while True:
        show_menu(agent_fns)

        try:
            choice = input(f"\n  {B}Agent >{R} ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print(f"\n\n  {DIM}Bye.{R}\n")
            break

        if choice in ("q", "quit", "exit"):
            print(f"\n  {DIM}Bye.{R}\n")
            break

        if choice in ("r", "restart"):
            agent_fns = load_all_agents()
            continue

        if choice not in agent_fns:
            warn(f"'{choice}' is not a valid option. Pick 1–{total}, r or q.")
            continue

        run_query(choice, agent_fns[choice], agent_fns)


if __name__ == "__main__":
    main()