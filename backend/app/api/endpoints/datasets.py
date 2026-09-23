import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import pandas as pd

from app.db.session import get_db
from app.models.entities import Dataset, Project
from app.schemas.schemas import DatasetResponse, DatasetHealthReport
from app.services.dataset_analyzer import DatasetAnalyzer, calculate_file_sha256, load_dataset
from app.core.config import settings

router = APIRouter()

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    project_id: int,
    file: UploadFile = File(...),
    target_column: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = file.filename
    clean_filename = f"{project_id}_{filename}"
    file_path = os.path.join(settings.DATA_DIR, clean_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        df = load_dataset(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded dataset: {str(e)}")

    sha256 = calculate_file_sha256(file_path)
    analysis = DatasetAnalyzer.analyze(df, target_candidate=target_column)

    # Inferred target if not specified
    if not target_column and analysis.get("potential_targets"):
        target_column = analysis["potential_targets"][0]

    dataset = Dataset(
        project_id=project_id,
        filename=filename,
        file_path=file_path,
        row_count=len(df),
        col_count=len(df.columns),
        sha256_hash=sha256,
        target_column=target_column,
        summary_stats=analysis
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    return dataset

@router.get("/project/{project_id}", response_model=List[DatasetResponse])
def get_project_datasets(project_id: int, db: Session = Depends(get_db)):
    return db.query(Dataset).filter(Dataset.project_id == project_id).order_by(Dataset.created_at.desc()).all()

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return d

@router.get("/{dataset_id}/health", response_model=DatasetHealthReport)
def get_dataset_health(dataset_id: int, target: Optional[str] = None, db: Session = Depends(get_db)):
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = load_dataset(d.file_path)
    analysis = DatasetAnalyzer.analyze(df, target_candidate=target or d.target_column)
    return analysis

@router.get("/{dataset_id}/preview")
def get_dataset_preview(dataset_id: int, limit: int = 50, db: Session = Depends(get_db)):
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    df = load_dataset(d.file_path)
    preview_df = df.head(limit).fillna("null")
    return {
        "columns": list(df.columns),
        "total_rows": len(df),
        "data": preview_df.to_dict(orient="records")
    }
