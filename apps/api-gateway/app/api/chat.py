from fastapi import APIRouter
from pydantic import BaseModel
from app.agents.graph import run_assistant
router=APIRouter(prefix='/api')
class Ask(BaseModel): message:str
@router.post('/chat')
def chat(req:Ask):
    return {'answer':run_assistant(req.message)}
