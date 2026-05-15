from typing import Generator

from app.agents.supervisor_agent import run_assistant, stream_assistant


class ChatService:
    def process_message(self, message: str) -> str:
        return run_assistant(message)

    def stream_message(self, message: str) -> Generator[str, None, None]:
        return stream_assistant(message)
