import os
from ..base_deep_agent import BaseDeepAgent, DATA_ROOT
from ..personalities import ADMIN_PERSONALITY


class AdminDeepAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "Admin Documents"),
        os.path.join(DATA_ROOT, "Admin Policies"),
    ]
    _PERSONALITY = ADMIN_PERSONALITY
    _FALLBACK_CONTACT = "Admin Team at admin@company.com"
