"""
Allocation Board API controller.
Role is resolved server-side from the user's designation (employee_details → allocation_role_map).
The client receives `designation` and `role` in every response — no client-side role inference needed.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.auth.auth_handler import get_current_user
from app.agents.allocation_agent import allocation_agent

router = APIRouter(prefix="/api/allocation", tags=["Allocation"])


@router.get("/board")
async def get_allocation_board(current_user: dict = Depends(get_current_user)):
    """
    Returns role-appropriate allocation board data for the authenticated user.
    Role is determined by the user's designation in employee_details.

    Response always includes `role` and `designation`.
    Shape of the data payload varies:

      analytics view  (executive / business_lead / functional_lead)
        → { role, designation, view, allocation_rows: [...], analytics: {...} }

      team view  (team_lead)
        → { role, designation, view, team_rows: [...] }

      self view  (employee / unknown)
        → { role, designation, view, my_allocation: [...] }
    """
    try:
        return allocation_agent.get_board(current_user["email"])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/employee/{employee_id}")
async def get_employee_detail(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns full detail for a specific employee.
    Sensitive fields (Effort %, Billability %, Completion Status) are null
    when the requester's designation-based role lacks column-level access.
    """
    data = allocation_agent.get_employee(employee_id, current_user["email"])
    if not data:
        raise HTTPException(status_code=404, detail="Employee not found")
    return data


class AskRequest(BaseModel):
    question: str


@router.post("/ask", summary="Ask Aura about your allocation data")
async def ask_aura(
    body: AskRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Natural-language Q&A over the user's role-scoped allocation data.
    Context is built from live DB data filtered to what the user can see.
    Returns { answer: str }.
    """
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")
    try:
        answer = allocation_agent.ask_aura(current_user["email"], body.question)
        return {"answer": answer}
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/my-role")
async def get_my_role(current_user: dict = Depends(get_current_user)):
    """
    Returns the authenticated user's designation and derived allocation role.

    Response: { email, designation, role }
      - designation: from employee_details (null if user not in that table)
      - role: from allocation_role_map matched by designation (defaults to 'employee')
    """
    return allocation_agent.get_role(current_user["email"])
