"""
forms_controller.py
===================
POST /api/ms-forms/create

Creates a Microsoft Form on behalf of the authenticated user.
The request body must include the form title, description, questions,
AND the user's Graph-scoped access token (acquired by the frontend via
MSAL with scope "https://graph.microsoft.com/Forms.ReadWrite").
"""

import traceback
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth.auth_handler import get_current_user

router = APIRouter(prefix="/api/ms-forms", tags=["Microsoft Forms"])


# ── Request / Response models ─────────────────────────────────────────────────

class FormQuestion(BaseModel):
    text: str = Field(..., description="The question text shown to respondents")
    type: Literal[
        "text",
        "single_choice",
        "multiple_choice",
        "rating",
        "date",
        "yes_no",
    ] = Field("text", description="Question type")
    required: bool = Field(False, description="Whether the question is required")
    choices: List[str] = Field(
        default_factory=list,
        description="Answer options — required for single_choice and multiple_choice types",
    )


class CreateFormRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Form title")
    description: Optional[str] = Field(None, max_length=1000, description="Optional form description")
    questions: List[FormQuestion] = Field(..., min_length=1, description="List of questions")
    graph_access_token: str = Field(
        ...,
        description=(
            "User's Graph API access token with Forms.ReadWrite scope. "
            "Acquired by the frontend via MSAL."
        ),
    )


class CreateFormResponse(BaseModel):
    form_id:  str
    web_url:  str
    edit_url: str
    title:    str


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/create",
    response_model=CreateFormResponse,
    summary="Create a Microsoft Form on behalf of the authenticated user",
)
def create_microsoft_form(
    req: CreateFormRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Creates a Microsoft Form using the user's delegated Graph access token.

    The form is created in the logged-in user's MyForms (OneDrive for Business)
    and includes all the specified questions.

    **Prerequisite**: The Azure App Registration must have the delegated
    permission `Forms.ReadWrite` granted by an admin.
    """
    if not req.graph_access_token.strip():
        raise HTTPException(
            status_code=422,
            detail="graph_access_token is required to create a Microsoft Form.",
        )

    if not req.questions:
        raise HTTPException(
            status_code=422,
            detail="At least one question is required.",
        )

    # Validate choice questions have options
    for i, q in enumerate(req.questions):
        if q.type in ("single_choice", "multiple_choice") and not q.choices:
            raise HTTPException(
                status_code=422,
                detail=f"Question {i + 1} is of type '{q.type}' but has no choices provided.",
            )

    try:
        from app.agents.ms_forms_agent import MSFormsAgent, MSFormsAgentError

        agent  = MSFormsAgent(access_token=req.graph_access_token)
        result = agent.create_form(
            title=req.title,
            description=req.description or "",
            questions=[q.model_dump() for q in req.questions],
        )
        return result

    except Exception as exc:
        from app.agents.ms_forms_agent import MSFormsAgentError
        if isinstance(exc, MSFormsAgentError):
            # Surface human-readable Graph errors to the caller
            raise HTTPException(status_code=502, detail=str(exc))
        print(f"[forms_controller] Unexpected error: {exc}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error creating Microsoft Form: {exc}",
        )
