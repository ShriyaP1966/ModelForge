import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "ModelForge"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Storage
    DATA_DIR: str = str(BASE_DIR.parent / "exports" / "data")
    MODELS_DIR: str = str(BASE_DIR.parent / "exports" / "models")
    DATABASE_URL: str = f"sqlite:///{BASE_DIR.parent}/modelforge.db"
    
    # AI settings
    AI_PROVIDER: str = "offline"  # offline, openai, gemini
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Computation safety (Phase 5): simple, student-laptop-appropriate caps.
    # A row limit bounds worst-case training time at the source; a timeout is
    # the backstop for whatever a row cap alone can't predict (e.g. SVM with
    # probability=True, or a high cross-validation fold count).
    MAX_DATASET_ROWS: int = 50000
    EXPERIMENT_TIMEOUT_SECONDS: int = 300

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Providers with a real, working implementation today. "openai" and "gemini"
# are kept in the schema/UI as a forward-compatible abstraction (so adding a
# real integration later doesn't require an API/DB shape change), but neither
# calls out to any external service yet. Selecting one is rejected server-side
# so the UI can never imply a paid provider is active when it isn't.
AI_AVAILABLE_PROVIDERS = ["offline"]

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.MODELS_DIR, exist_ok=True)
