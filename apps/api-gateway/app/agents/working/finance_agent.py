import os
from .base_deep_agent import BaseDeepAgent, DATA_ROOT
from .personalities import FINANCE_PERSONALITY


class FinanceAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "Account & Finance Policies"),
    ]
    _PERSONALITY = FINANCE_PERSONALITY
    _FALLBACK_CONTACT = "Finance Team at finance@alignedautomation.com"
