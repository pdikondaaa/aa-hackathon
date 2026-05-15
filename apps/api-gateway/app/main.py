from dotenv import load_dotenv
load_dotenv()  # must run before any module that reads os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.controllers.chat_controller import router as chat_router
from app.api.controllers.conversations_controller import router as conversations_router
from app.api.controllers.debug_controller import router as debug_router
from app.api.controllers.health_controller import router as health_router
from app.api.controllers.messages_controller import conv_router as messages_conv_router
from app.api.controllers.messages_controller import msg_router as messages_msg_router
from app.api.controllers.feedback_controller import msg_router as feedback_msg_router
from app.api.controllers.feedback_controller import fb_router as feedback_fb_router
from app.api.controllers.feedback_controller import admin_router as feedback_admin_router
from app.api.controllers.escalations_controller import esc_router as escalations_router
from app.api.controllers.escalations_controller import admin_router as escalations_admin_router
from app.api.controllers.pii_controller import router as pii_router
from app.api.onboarding import router as onboarding_router


tags_metadata = [
    {"name": "Chat", "description": "AI-powered chat endpoints secured with Azure AD authentication."},
    {"name": "Conversations", "description": "Conversation CRUD — list, create, rename, soft-delete."},
    {"name": "Messages", "description": "Send, list, fetch, regenerate, stop, and cite messages."},
    {"name": "Feedback", "description": "Submit, update, and admin-list thumbs up/down feedback on messages."},
    {"name": "Escalations", "description": "Create, track, and manage HR/IT/Admin escalations with dynamic forms."},
    {"name": "PII", "description": "Admin PII rule management, redaction event logs, review, and analytics."},
    {"name": "Health", "description": "Service and database health checks."},
    {"name": "Debug", "description": "Debug and diagnostic endpoints."},
]

app = FastAPI(
    title="AURA",
    description="AURA – AI-powered assistant API. Swagger UI at `/docs`, ReDoc at `/redoc`.",
    version="1.0.0",
    openapi_tags=tags_metadata,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(messages_conv_router)
app.include_router(messages_msg_router)
app.include_router(feedback_msg_router)
app.include_router(feedback_fb_router)
app.include_router(feedback_admin_router)
app.include_router(escalations_router)
app.include_router(escalations_admin_router)
app.include_router(pii_router)
app.include_router(health_router)
app.include_router(debug_router)
app.include_router(onboarding_router)
