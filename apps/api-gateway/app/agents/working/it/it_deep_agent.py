import os
from ..base_deep_agent import BaseDeepAgent, DATA_ROOT
from ..personalities import IT_PERSONALITY


class ITDeepAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "IT Administrator Policies"),
        os.path.join(DATA_ROOT, "IT Administrator Doc"),
    ]
    _PERSONALITY = IT_PERSONALITY
    _FALLBACK_CONTACT = "IT Helpdesk at helpdesk@company.com or +1-800-IT-HELP"
