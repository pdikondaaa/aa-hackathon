"""JWT token validation using Azure AD JWKS (Final Fixed Version)."""

import requests
import time
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode
from jose.exceptions import JWKError
from typing import Optional, Dict, Any
from app.api.config.auth_config import JWKS_URL, ISSUER, CLIENT_ID, ALGORITHMS

# Simple in-memory cache for JWKS keys
_jwks_cache: Optional[Dict[str, Any]] = None


def _get_jwks() -> Dict[str, Any]:
    """
    Fetch JWKS keys from Azure AD discovery endpoint.
    Uses simple in-memory caching to reduce API calls.
    """
    global _jwks_cache

    if _jwks_cache is None:
        response = requests.get(JWKS_URL)
        response.raise_for_status()
        _jwks_cache = response.json()

    return _jwks_cache


def _get_signing_key(token: str) -> Dict[str, Any]:
    """
    Extract the correct signing key from JWKS using token's kid.
    """
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    if not kid:
        raise JWTError("Token header missing 'kid'")

    jwks = _get_jwks()

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise JWTError(f"Unable to find signing key with kid: {kid}")


def _verify_signature(token: str, signing_key: Dict[str, Any]) -> None:
    """
    Verify JWT signature manually using RSA public key.
    """

    # ✅ FIX: Azure JWKS does not include "alg", so we add it
    if "alg" not in signing_key:
        signing_key["alg"] = "RS256"

    try:
        public_key = jwk.construct(signing_key)
    except JWKError as e:
        raise JWTError(f"Key construction failed: {str(e)}")

    message, encoded_signature = token.rsplit(".", 1)
    decoded_signature = base64url_decode(encoded_signature.encode())

    if not public_key.verify(message.encode(), decoded_signature):
        raise JWTError("Signature verification failed")


def validate_token(token: str) -> Dict[str, Any]:
    """
    Validate JWT token from Azure AD.

    Args:
        token: JWT access token

    Returns:
        Decoded JWT payload

    Raises:
        JWTError: If token is invalid, expired, or verification fails
    """
    try:
        # Step 1: Get signing key
        signing_key = _get_signing_key(token)

        # Step 2: Verify signature
        _verify_signature(token, signing_key)

        # Step 3: Decode claims (no verification here)
        payload = jwt.get_unverified_claims(token)

        # Step 4: Validate issuer
        if payload.get("iss") != ISSUER:
            raise JWTError(f"Invalid issuer: {payload.get('iss')}")

        # Step 5: Validate audience (STRICT)
        if payload.get("aud") != CLIENT_ID:
            raise JWTError(f"Invalid audience: {payload.get('aud')}")

        # Step 6: Validate expiration
        exp = payload.get("exp")
        if exp and exp < time.time():
            raise JWTError("Token has expired")

        return payload

    except JWTError as e:
        raise JWTError(f"Invalid token: {str(e)}")