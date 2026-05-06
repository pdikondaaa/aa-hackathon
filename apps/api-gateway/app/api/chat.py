from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.agents.graph import run_assistant
from app.api.auth import verify_token

router = APIRouter(prefix='/api')


class Ask(BaseModel):
    message: str


@router.post('/chat', dependencies=[Depends(verify_token)])
def chat(req: Ask):
    return {'answer': run_assistant(req.message)}
