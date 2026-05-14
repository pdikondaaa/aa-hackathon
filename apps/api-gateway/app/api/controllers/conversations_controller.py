from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.services.conversations_service import ConversationsService

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])

_service = ConversationsService()


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
):
    """Sidebar list of recent chats. Supports pagination and search."""
    return _service.list_conversations("dev-user", page, limit, search)


@router.post("", response_model=ConversationOut, status_code=201, summary="Create conversation")
def create_conversation(body: ConversationCreate):
    """Start a new chat thread. Writes to conversations and audit_logs."""
    try:
        return _service.create_conversation("dev-user", body.title)
    except Exception as e:
        print(f"ERROR in POST /api/conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=ConversationOut, summary="Get conversation")
def get_conversation(id: str):
    """Fetch single conversation metadata."""
    conversation = _service.get_conversation(id, "dev-user")
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.patch("/{id}", response_model=ConversationOut, summary="Rename conversation")
def rename_conversation(id: str, body: ConversationRename):
    """Update the conversation title."""
    conversation = _service.rename_conversation(id, body.title, "dev-user")
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/{id}", status_code=204, summary="Delete conversation")
def delete_conversation(id: str):
    """Soft-delete a chat. Writes to conversations and audit_logs."""
    deleted = _service.delete_conversation(id, "dev-user")
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
