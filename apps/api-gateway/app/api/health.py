from fastapi import APIRouter
router=APIRouter(prefix='/health')
@router.get('')
def health():
 return {'service':'up'}
@router.get('/db')
def db():
 return {'db':'healthy (stub)'}
