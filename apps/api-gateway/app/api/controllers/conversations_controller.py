from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user
from app.api.services.conversations_service import ConversationsService
from app.api.services.user_service import get_or_create_user

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])

_service = ConversationsService()


def _resolve_user(current_user: dict) -> str:
    """Resolve Azure OID to the DB user UUID, creating the user row if needed."""
    return get_or_create_user(
        current_user["user_id"],
        current_user["email"],
        current_user.get("name") or current_user["email"],
    )


# ---------- Request / Response models ----------

class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationRename(BaseModel):
    title: str


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListOut(BaseModel):
    data: list[ConversationOut]
    total: int
    page: int
    limit: int


# ---------- Endpoints ----------

@router.get("", response_model=ConversationListOut, summary="List conversations")
def list_conversations(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Filter by title"),
    current_user: dict = Depends(get_current_user),
):
    """Sidebar list of recent chats. Supports pagination and search."""
    user_id = _resolve_user(current_user)
    return _service.list_conversations(user_id, page, limit, search)


@router.post("", response_model=ConversationOut, status_code=201, summary="Create conversation")
def create_conversation(body: ConversationCreate, current_user: dict = Depends(get_current_user)):
    """Start a new chat thread. Writes to conversations and audit_logs."""
    try:
        user_id = _resolve_user(current_user)
        return _service.create_conversation(user_id, body.title)
    except Exception as e:
        print(f"ERROR in POST /api/conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=ConversationOut, summary="Get conversation")
def get_conversation(id: str, current_user: dict = Depends(get_current_user)):
    """Fetch single conversation metadata."""
    user_id = _resolve_user(current_user)
    conversation = _service.get_conversation(id, user_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.patch("/{id}", response_model=ConversationOut, summary="Rename conversation")
def rename_conversation(id: str, body: ConversationRename, current_user: dict = Depends(get_current_user)):
    """Update the conversation title."""
    user_id = _resolve_user(current_user)
    conversation = _service.rename_conversation(id, body.title, user_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/{id}", status_code=204, summary="Delete conversation")
def delete_conversation(id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete a chat. Writes to conversations and audit_logs."""
    user_id = _resolve_user(current_user)
    deleted = _service.delete_conversation(id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
