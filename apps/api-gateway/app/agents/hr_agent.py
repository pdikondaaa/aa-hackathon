from dotenv import load_dotenv

load_dotenv()

from .deep.hr_deep_agent import HRDeepAgent
from .deep.config import DeepAgentConfig

# Single shared instance — loaded once at import time
_agent = HRDeepAgent(config=DeepAgentConfig())


def hr_agent(query: str) -> str:
    """HR Agent entry point — backward-compatible with supervisor_agent."""
    return _agent.process_query(query)
