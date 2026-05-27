from typing import Generator

from app.agents.supervisor_agent import run_assistant, stream_assistant


class ChatService:
    def process_message(self, message: str, user_email: str = "", user_id: str = "") -> str:
        return run_assistant(message, user_email=user_email, user_id=user_id)

    def stream_message(self, message: str) -> Generator[str, None, None]:
        return stream_assistant(message)
