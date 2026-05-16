"""
Email Agent controller — POST /api/email-agent/refine
"""
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth.auth_handler import get_current_user

router = APIRouter(prefix="/api/email-agent", tags=["Email Agent"])


class RefineRequest(BaseModel):
    to: str = ""
    cc: Optional[str] = None
    subject: str = ""
    body: str


class RefineResponse(BaseModel):
    refined_subject: str
    refined_body: str


class ChatEmailRequest(BaseModel):
    message: str


class ChatEmailResponse(BaseModel):
    to: str
    refined_subject: str
    refined_body: str


@router.post(
    "/refine",
    response_model=RefineResponse,
    summary="Refine an email draft with AI",
)
def refine_email(
    req: RefineRequest,
    current_user: dict = Depends(get_current_user),
):
    if not req.body or not req.body.strip():
        raise HTTPException(status_code=422, detail="Email body cannot be empty.")

    try:
        from app.agents.email_agent import refine_email_draft
        result = refine_email_draft(
            to=req.to,
            cc=req.cc or None,
            subject=req.subject,
            body=req.body,
        )
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        print(f"[email_controller] Unexpected error: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")


@router.post(
    "/from-chat",
    response_model=ChatEmailResponse,
    summary="Draft a professional email from a plain-language chat request",
)
def email_from_chat(
    req: ChatEmailRequest,
    current_user: dict = Depends(get_current_user),
):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    try:
        from app.agents.email_agent import draft_email_from_chat
        result = draft_email_from_chat(req.message)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        print(f"[email_controller] Unexpected error in from-chat: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {exc}")
