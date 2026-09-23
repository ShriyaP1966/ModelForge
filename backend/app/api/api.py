from fastapi import APIRouter
from app.api.endpoints import projects, datasets, experiments, reproduce, ai, settings_api

api_router = APIRouter()

api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(experiments.router, prefix="/experiments", tags=["experiments"])
api_router.include_router(reproduce.router, prefix="/reproduce", tags=["reproduce"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(settings_api.router, prefix="/settings", tags=["settings"])
