from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.api.api import api_router
from app.models.entities import Project
from app.api.endpoints.projects import seed_sample_projects

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ModelForge: AI Model Evolution Lab - A free-first machine-learning experimentation platform"
)

# CORS: explicit local dev origins rather than "*". This is a single-user,
# local-only app -- the frontend is always Vite, either the dev server
# (default port 5173) or `vite preview` (default port 4173) -- so there's no
# reason to accept requests claiming to come from anywhere else. Also, "*"
# combined with allow_credentials=True isn't even valid per the CORS spec.
extra_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        *extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        # If no projects exist, seed default sample projects
        count = db.query(Project).count()
        if count == 0:
            seed_sample_projects(db)
    except Exception as e:
        print(f"Startup seeding notice: {e}")
    finally:
        db.close()

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "tagline": "See how your machine-learning model evolves.",
        "status": "operational",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
