from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings, AI_AVAILABLE_PROVIDERS

router = APIRouter()

class SettingsUpdateRequest(BaseModel):
    ai_provider: str
    openai_api_key: str = ""
    gemini_api_key: str = ""

@router.get("/")
def get_settings():
    return {
        "project_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ai_provider": settings.AI_PROVIDER,
        "available_ai_providers": AI_AVAILABLE_PROVIDERS,
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "data_dir": settings.DATA_DIR,
        "models_dir": settings.MODELS_DIR,
        "database_url": settings.DATABASE_URL
    }

@router.post("/")
def update_settings(payload: SettingsUpdateRequest):
    if payload.ai_provider not in AI_AVAILABLE_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"AI provider '{payload.ai_provider}' is not implemented yet. "
                f"Currently available: {', '.join(AI_AVAILABLE_PROVIDERS)}."
            )
        )
    settings.AI_PROVIDER = payload.ai_provider
    if payload.openai_api_key:
        settings.OPENAI_API_KEY = payload.openai_api_key
    if payload.gemini_api_key:
        settings.GEMINI_API_KEY = payload.gemini_api_key
    return {"message": "Settings updated successfully", "ai_provider": settings.AI_PROVIDER}
