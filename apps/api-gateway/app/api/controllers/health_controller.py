from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def health():
    return {"service": "up"}


@router.get("/db")
def db():
    return {"db": "healthy (stub)"}
