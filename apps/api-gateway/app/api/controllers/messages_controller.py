from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.auth.jwt_auth_handler import jwt_auth
from app.api.services.messages_service import MessagesService

_service = MessagesService()

# Two prefixes — conversation-scoped and message-scoped — share one file
conv_router = APIRouter(prefix="/api/conversations", tags=["Messages"])
msg_router  = APIRouter(prefix="/api/messages",      tags=["Messages"])


# ---------- Shared models ----------

class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    status: str
    created_at: datetime


class MessageListOut(BaseModel):
    data: list[MessageOut]
    total: int
    page: int
    limit: int


class CitationOut(BaseModel):
    chunk_id: str
    chunk_index: int
    chunk_content: str
    document_id: str
    document_title: str
    source_url: Optional[str] = None


# ---------- Request models ----------

class SendMessageIn(BaseModel):
    content: str


# ------------------------------------------------------------------ #
# 1. Send message  POST /api/conversations/{id}/messages             #
# ------------------------------------------------------------------ #
@conv_router.post(
    "/{id}/messages",
    response_model=MessageOut,
    status_code=202,
    summary="Send message",
)
def send_message(id: str, body: SendMessageIn, ctx: dict = Depends(jwt_auth)):
    """Accept a user message, store it, and enqueue the assistant reply.
    Returns the assistant message record (status='pending' until the agent writes back)."""
    result = _service.send_message(id, ctx["claims"]["sub"], body.content)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


# ------------------------------------------------------------------ #
# 2. List messages  GET /api/conversations/{id}/messages             #
# ------------------------------------------------------------------ #
@conv_router.get(
    "/{id}/messages",
    response_model=MessageListOut,
    summary="List messages",
)
def list_messages(
    id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    ctx: dict = Depends(jwt_auth),
):
    """Load chat history for an open conversation."""
    result = _service.list_messages(id, ctx["claims"]["sub"], page, limit)
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


# ------------------------------------------------------------------ #
# 3. Get message  GET /api/messages/{id}                             #
# ------------------------------------------------------------------ #
@msg_router.get(
    "/{id}",
    response_model=MessageOut,
    summary="Get message",
)
def get_message(id: str, ctx: dict = Depends(jwt_auth)):
    """Fetch a single message."""
    message = _service.get_message(id, ctx["claims"]["sub"])
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


# ------------------------------------------------------------------ #
# 4. Regenerate response  POST /api/messages/{id}/regenerate         #
# ------------------------------------------------------------------ #
@msg_router.post(
    "/{id}/regenerate",
    response_model=MessageOut,
    status_code=202,
    summary="Regenerate response",
)
def regenerate_response(id: str, ctx: dict = Depends(jwt_auth)):
    """Mark the assistant message as superseded and enqueue a fresh generation."""
    result = _service.regenerate_response(id, ctx["claims"]["sub"])
    if result is None:
        raise HTTPException(status_code=404, detail="Assistant message not found")
    return result


# ------------------------------------------------------------------ #
# 5. Stop generation  POST /api/messages/{id}/stop                   #
# ------------------------------------------------------------------ #
@msg_router.post(
    "/{id}/stop",
    response_model=MessageOut,
    summary="Stop generation",
)
def stop_generation(id: str, ctx: dict = Depends(jwt_auth)):
    """Cancel an in-flight stream for the given assistant message."""
    result = _service.stop_generation(id, ctx["claims"]["sub"])
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Message not found or not currently streaming",
        )
    return result


# ------------------------------------------------------------------ #
# 6. Get citations  GET /api/messages/{id}/citations                 #
# ------------------------------------------------------------------ #
@msg_router.get(
    "/{id}/citations",
    response_model=list[CitationOut],
    summary="Get citations",
)
def get_citations(id: str, ctx: dict = Depends(jwt_auth)):
    """Expand citation details — returns the document chunks that sourced the reply."""
    citations = _service.get_citations(id, ctx["claims"]["sub"])
    if citations is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return citations
