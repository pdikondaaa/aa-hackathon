from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.debug import router as debug_router
from app.api.onboarding import router as onboarding_router

app = FastAPI(title='AURA')

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(health_router)
app.include_router(debug_router)
app.include_router(onboarding_router)
