"""Azure AD authentication configuration."""

import os
from pathlib import Path


def _load_dotenv(dotenv_path: Path):
    """Load environment variables from a .env file if present."""
    if not dotenv_path.exists():
        return

    with dotenv_path.open("r", encoding="utf-8") as dotenv_file:
        for line in dotenv_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            if "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key and key not in os.environ:
                os.environ[key] = value


# Load from the repo root .env (aa-hackathon/.env)
BASE_DIR = Path(__file__).resolve().parents[5]
_dotenv_path = BASE_DIR / ".env"
_load_dotenv(_dotenv_path)

# Azure AD environment variables
TENANT_ID = os.getenv("AZURE_TENANT_ID")
CLIENT_ID = os.getenv("AZURE_CLIENT_ID")

if not TENANT_ID or not CLIENT_ID:
    raise RuntimeError(
        "Missing Azure AD environment variables. Set AZURE_TENANT_ID and AZURE_CLIENT_ID "
        "either in the environment, .env file, or VS Code launch configuration."
    )

# Azure AD endpoints
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
ISSUER = f"{AUTHORITY}/v2.0"
JWKS_URL = f"{AUTHORITY}/discovery/v2.0/keys"

# JWT validation
ALGORITHMS = ["RS256"]
