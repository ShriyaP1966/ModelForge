import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Project, Dataset, Experiment
from app.schemas.schemas import ProjectCreate, ProjectResponse
from app.services.dataset_analyzer import calculate_file_sha256, DatasetAnalyzer, load_dataset
from app.core.config import settings

router = APIRouter()

@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    res = []
    for p in projects:
        d_count = db.query(Dataset).filter(Dataset.project_id == p.id).count()
        e_count = db.query(Experiment).filter(Experiment.project_id == p.id).count()
        res.append(ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            task_type=p.task_type,
            created_at=p.created_at,
            updated_at=p.updated_at,
            dataset_count=d_count,
            experiment_count=e_count
        ))
    return res

@router.post("/", response_model=ProjectResponse)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    p = Project(
        name=payload.name,
        description=payload.description,
        task_type=payload.task_type
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProjectResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        task_type=p.task_type,
        created_at=p.created_at,
        updated_at=p.updated_at,
        dataset_count=0,
        experiment_count=0
    )

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    d_count = db.query(Dataset).filter(Dataset.project_id == p.id).count()
    e_count = db.query(Experiment).filter(Experiment.project_id == p.id).count()
    return ProjectResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        task_type=p.task_type,
        created_at=p.created_at,
        updated_at=p.updated_at,
        dataset_count=d_count,
        experiment_count=e_count
    )

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"message": "Project deleted successfully"}

@router.post("/seed-sample")
def seed_sample_projects(db: Session = Depends(get_db)):
    """Seed sample projects with preloaded datasets for instant exploration."""
    from pathlib import Path
    sample_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / "sample_data"
    created = []

    samples = [
        {
            "name": "Titanic Passenger Survival",
            "description": "Predict passenger survival on the Titanic. Demonstrates feature imputation, scaling, and classification model evolution.",
            "task_type": "classification",
            "filename": "classification_titanic.csv",
            "target": "Survived"
        },
        {
            "name": "California Housing Valuation",
            "description": "Predict median house values using geographical and demographic census features. Regression pipeline evolution.",
            "task_type": "regression",
            "filename": "regression_housing.csv",
            "target": "MedHouseVal"
        },
        {
            "name": "Synthetic Fraud & Quality Stress Test",
            "description": "Stress-test dataset intelligence with intentional data leaks, duplicate rows, constant columns, and extreme class imbalance.",
            "task_type": "classification",
            "filename": "problematic_dataset.csv",
            "target": "fraud"
        }
    ]

    for s in samples:
        proj = db.query(Project).filter(Project.name == s["name"]).first()
        if not proj:
            proj = Project(
                name=s["name"],
                description=s["description"],
                task_type=s["task_type"]
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)

        # Check if dataset already attached
        existing_ds = db.query(Dataset).filter(Dataset.project_id == proj.id).first()
        if existing_ds:
            continue

        src_path = os.path.join(str(sample_dir), s["filename"])
        if os.path.exists(src_path):
            dest_filename = f"{proj.id}_{s['filename']}"
            dest_path = os.path.join(settings.DATA_DIR, dest_filename)
            shutil.copyfile(src_path, dest_path)

            df = load_dataset(dest_path)
            analysis = DatasetAnalyzer.analyze(df, target_candidate=s["target"])
            sha256 = calculate_file_sha256(dest_path)

            dataset = Dataset(
                project_id=proj.id,
                filename=s["filename"],
                file_path=dest_path,
                row_count=len(df),
                col_count=len(df.columns),
                sha256_hash=sha256,
                target_column=s["target"],
                summary_stats=analysis
            )
            db.add(dataset)
            db.commit()

        created.append(proj.name)

    return {"message": "Sample projects initialized", "projects": created}
