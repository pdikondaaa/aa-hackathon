from app.agents.supervisor_agent import run_assistant


class ChatService:
    def process_message(self, message: str) -> str:
        return run_assistant(message)
