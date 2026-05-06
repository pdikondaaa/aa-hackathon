"""Authentication handler with FastAPI security dependency."""

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from typing import Dict, Any
from app.api.auth.jwt_validator import validate_token

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    FastAPI dependency that validates JWT token and extracts user info.
    
    Args:
        credentials: HTTPBearer credentials from Authorization header
        
    Returns:
        Dictionary with user information (user_id, email, name)
        
    Raises:
        HTTPException: 401 if token missing/invalid, 403 if verification fails
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")
    
    try:
        payload = validate_token(token)
    except JWTError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    # Extract user information from payload
    # v2.0 tokens use "preferred_username"; v1.0 tokens use "unique_name"
    user = {
        "user_id": payload.get("oid"),
        "email": payload.get("preferred_username") or payload.get("unique_name"),
        "name": payload.get("name"),
    }
    
    # Validate required fields
    if not user["user_id"] or not user["email"]:
        raise HTTPException(status_code=403, detail="Token missing required claims")
    
    return user
