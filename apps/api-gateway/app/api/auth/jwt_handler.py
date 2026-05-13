"""Issues and decodes AURA's own short-lived JWTs (HS256).

These are separate from Azure AD tokens. The SSO callback validates the
Azure id_token, then exchanges it for an AURA JWT that carries:
  sub         = users.id (UUID)
  oid         = Azure object ID
  email       = user email
  role        = user role (e.g. 'user', 'admin')
  session_id  = user_sessions.id (UUID)
"""

import os
import time
from typing import Any

from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

_SECRET = os.getenv("JWT_SECRET", "")
_ALGORITHM = "HS256"
_EXPIRY_SECONDS = 3600  # 1 hour

if not _SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set.")


def issue_token(
    *,
    user_id: str,
    azure_oid: str,
    email: str,
    role: str,
    session_id: str,
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "oid": azure_oid,
        "email": email,
        "role": role,
        "session_id": session_id,
        "iat": now,
        "exp": now + _EXPIRY_SECONDS,
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate the AURA JWT. Raises ValueError on any failure."""
    try:
        return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except JWTError as exc:
        raise ValueError(f"Token invalid or expired: {exc}") from exc
