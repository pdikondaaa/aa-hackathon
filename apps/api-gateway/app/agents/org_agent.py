from app.agents.working.base_deep_agent import BaseDeepAgent
from app.agents.working.personalities import ORG_PERSONALITY


class OrgDeepAgent(BaseDeepAgent):



    """
    Org agent — answers company-wide questions (mission, structure, values, general policies).
    Relies entirely on pgvector; no local data folders needed.
    """
    _DATA_FOLDERS = []
    _PERSONALITY = ORG_PERSONALITY
    _FALLBACK_CONTACT = "General Inquiries at info@alignedautomation.com"
