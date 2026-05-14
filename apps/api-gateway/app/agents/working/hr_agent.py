import os
from .base_deep_agent import BaseDeepAgent, DATA_ROOT
from .personalities import HR_PERSONALITY


class HRAgent(BaseDeepAgent):
    _DATA_FOLDERS = [
        os.path.join(DATA_ROOT, "HR Policies"),
        os.path.join(DATA_ROOT, "HR Document"),
    ]
    _PERSONALITY = HR_PERSONALITY
    _FALLBACK_CONTACT = "HR at hr@alignedautomation.com"
