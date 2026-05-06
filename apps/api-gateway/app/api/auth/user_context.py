"""User context helper for accessing user info from request state."""

from fastapi import Request
from typing import Optional, Dict, Any


def get_user(request: Request) -> Optional[Dict[str, Any]]:
    """
    Retrieve user information from request state.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        User dictionary or None if not found
    """
    return getattr(request.state, "user", None)
