from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Experiment, Project, Dataset
from app.schemas.schemas import (
    ExperimentCreate, ExperimentResponse, ExperimentDiffResponse,
    LineageNode
)
from app.services.experiment_manager import ExperimentManager
from app.services.visualization_service import VisualizationService

router = APIRouter()

@router.post("/", response_model=ExperimentResponse)
def create_experiment(
    payload: ExperimentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.project_id != project.id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Dataset #{dataset.id} belongs to project {dataset.project_id}, not project "
                f"{project.id}. An experiment must use a dataset from its own project."
            )
        )

    if payload.parent_id is not None:
        parent = db.query(Experiment).filter(Experiment.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail=f"Parent experiment #{payload.parent_id} not found.")
        if parent.project_id != project.id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Parent experiment #{parent.id} belongs to project {parent.project_id}, not project "
                    f"{project.id}. An experiment can only branch from a parent within the same project, "
                    f"which also guarantees they share the same task type (classification/regression)."
                )
            )

    # If primary metric was not set, choose default based on task_type
    pm = payload.primary_metric
    if not pm:
        pm = "f1" if project.task_type == "classification" else "rmse"

    exp = Experiment(
        project_id=payload.project_id,
        dataset_id=payload.dataset_id,
        parent_id=payload.parent_id,
        name=payload.name,
        description=payload.description,
        model_type=payload.model_type,
        hyperparameters=payload.hyperparameters or {},
        preprocessing_config=payload.preprocessing_config.model_dump(),
        feature_selection=payload.feature_selection or [],
        target_column=payload.target_column,
        random_seed=payload.random_seed,
        test_size=payload.test_size,
        cross_validation_folds=payload.cross_validation_folds,
        primary_metric=pm,
        status="queued"
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    # Execute synchronously so the user receives complete results immediately,
    # or handle within fast interactive loop
    ExperimentManager.run_experiment(db=db, experiment_id=exp.id)
    db.refresh(exp)

    return exp

@router.get("/project/{project_id}", response_model=List[ExperimentResponse])
def get_project_experiments(project_id: int, db: Session = Depends(get_db)):
    return db.query(Experiment).filter(
        Experiment.project_id == project_id
    ).order_by(Experiment.created_at.desc()).all()

@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp

@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    db.delete(exp)
    db.commit()
    return {"message": "Experiment deleted successfully"}

@router.get("/project/{project_id}/lineage", response_model=List[LineageNode])
def get_project_lineage(project_id: int, db: Session = Depends(get_db)):
    return ExperimentManager.get_lineage(db=db, project_id=project_id)

@router.get("/project/{project_id}/evolution")
def get_project_evolution(project_id: int, db: Session = Depends(get_db)):
    return ExperimentManager.get_evolution_timeline(db=db, project_id=project_id)

@router.get("/{experiment_id}/pipeline-graph")
def get_experiment_pipeline_graph(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return VisualizationService.generate_pipeline_graph(exp)

@router.get("/{experiment_id}/diff/{compare_id}", response_model=ExperimentDiffResponse)
def get_experiment_diff(experiment_id: int, compare_id: int, db: Session = Depends(get_db)):
    exp_a = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    exp_b = db.query(Experiment).filter(Experiment.id == compare_id).first()
    if not exp_a or not exp_b:
        raise HTTPException(status_code=404, detail="One or both experiments not found")

    if exp_a.project_id != exp_b.project_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot compare experiment #{exp_a.id} (project {exp_a.project_id}) with experiment "
                f"#{exp_b.id} (project {exp_b.project_id}). Experiment comparison is only meaningful "
                f"within the same project, which also guarantees a shared task type."
            )
        )

    return VisualizationService.compute_experiment_diff(exp_a, exp_b)
