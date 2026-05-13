import os
from ..base_deep_agent import BaseDeepAgent, DATA_ROOT
from ..personalities import HR_PERSONALITY


class HRDeepAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "HR Policies"),
        os.path.join(DATA_ROOT, "HR Document"),
    ]
    _PERSONALITY = HR_PERSONALITY
    _FALLBACK_CONTACT = "HR at hr@company.com or +1-800-HR-HELP"
