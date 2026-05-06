from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from cachetools import TTLCache, cached
import httpx

from app.core.config import settings

security = HTTPBearer()

_JWKS_URL = f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/discovery/v2.0/keys"

# Azure AD issues tokens with either v1 or v2 issuer depending on app manifest setting
_VALID_ISSUERS = [
    f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/v2.0",
    f"https://sts.windows.net/{settings.AZURE_TENANT_ID}/",
]

_jwks_cache: TTLCache = TTLCache(maxsize=1, ttl=86400)  # 24-hour cache


@cached(_jwks_cache)
def _fetch_jwks() -> dict:
    response = httpx.get(_JWKS_URL, timeout=10)
    response.raise_for_status()
    return response.json()


def _get_rsa_key(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token header")

    for key in _fetch_jwks().get("keys", []):
        if key["kid"] == header.get("kid"):
            return {k: key[k] for k in ("kty", "kid", "use", "n", "e")}

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signing key not found")


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    rsa_key = _get_rsa_key(token)

    for issuer in _VALID_ISSUERS:
        try:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings.AZURE_CLIENT_ID,
                issuer=issuer,
                options={"verify_exp": True},
            )
            return payload
        except JWTError:
            continue

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
