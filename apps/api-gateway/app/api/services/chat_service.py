from typing import AsyncGenerator

from app.agents.supervisor_agent import run_assistant, stream_assistant


class ChatService:
    def process_message(self, message: str, user_email: str = "", user_id: str = "") -> str:
        return run_assistant(message, user_email=user_email, user_id=user_id)

    async def stream_message(self, message: str, user_email: str = "", user_id: str = "") -> AsyncGenerator[str, None]:
        async for chunk in stream_assistant(message, user_email=user_email, user_id=user_id):
            yield chunk
