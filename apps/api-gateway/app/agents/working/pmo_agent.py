import os
from .base_deep_agent import BaseDeepAgent, DATA_ROOT
from .personalities import PMO_PERSONALITY


class PMOAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "PMO Docs"),
    ]
    _PERSONALITY = PMO_PERSONALITY
    _FALLBACK_CONTACT = "PMO Team at pmo@alignedautomation.com"
