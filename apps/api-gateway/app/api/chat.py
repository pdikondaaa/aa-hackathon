from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
import traceback
from app.agents.supervisor_agent import run_assistant
from app.api.auth.auth_handler import get_current_user
from app.api.auth.user_context import get_user

router = APIRouter(prefix='/api')


class Ask(BaseModel):
    message: str


@router.post('/chat')
def chat(
    req: Ask,
    request: Request,
    user=Depends(get_current_user)
):
    """
    Chat endpoint secured with Azure AD authentication.
    
    Args:
        req: Chat request with message
        request: FastAPI request object
        user: Authenticated user (from JWT token)
        
    Returns:
        Chat response with answer and user email
    """
    try:
        # Access user from dependency injection
        user_email = user["email"]
        user_id = user["user_id"]
        
        # Call agent
        response = run_assistant(req.message)
        
        return {
            "answer": response,
            "user_email": user_email,
            "user_id": user_id,
        }
    
    except Exception as e:
        print(f"ERROR in /api/chat: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
