import traceback

from fastapi import APIRouter, Depends, HTTPException, Request
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
def chat(req: Ask, request: Request, user=Depends(get_current_user)):
    """Chat endpoint secured with Azure AD authentication."""
    try:
        answer = _chat_service.process_message(req.message)
        return {"answer": answer, "user_email": user["email"], "user_id": user["user_id"]}
    except Exception as e:
        print(f"ERROR in /api/chat: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
