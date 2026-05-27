import traceback

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user
from app.api.services.chat_service import ChatService

router = APIRouter(prefix="/api", tags=["Chat"])

_chat_service = ChatService()


class Ask(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str
    user_email: str
    user_id: str


@router.post("/chat", response_model=ChatResponse)
def chat(req: Ask, user=Depends(get_current_user)):
    """Chat endpoint — returns full answer as JSON."""
    try:
        answer = _chat_service.process_message(req.message, user_email=user["email"], user_id=user["user_id"])
        return {"answer": answer, "user_email": user["email"], "user_id": user["user_id"]}
    except Exception as e:
        print(f"ERROR in /api/chat: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.post("/chat/stream")
def chat_stream(req: Ask, _user=Depends(get_current_user)):
    """Streaming chat endpoint — returns SSE chunks so the UI renders tokens as they arrive."""
    try:
        return StreamingResponse(
            _chat_service.stream_message(req.message),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        print(f"ERROR in /api/chat/stream: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
