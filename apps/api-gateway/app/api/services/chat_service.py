from app.agents.supervisor_agent import run_assistant


class ChatService:
    def process_message(self, message: str, user_email: str = "", user_id: str = "") -> str:
        return run_assistant(message, user_email=user_email, user_id=user_id)
