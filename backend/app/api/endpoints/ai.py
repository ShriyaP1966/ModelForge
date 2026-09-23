from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Experiment
from app.schemas.schemas import AIExplainRequest, AIExplainResponse
from app.services.visualization_service import VisualizationService
from app.services.ai_explanation_service import AIExplanationService

router = APIRouter()

@router.post("/explain", response_model=AIExplainResponse)
def explain_experiment(payload: AIExplainRequest, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == payload.experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")

    baseline_exp = None
    baseline_id = payload.baseline_experiment_id or exp.parent_id
    if baseline_id:
        baseline_exp = db.query(Experiment).filter(Experiment.id == baseline_id).first()

    # If no baseline, compare with itself to show initial configuration insights
    compare_target = baseline_exp if baseline_exp else exp
    diff_data = VisualizationService.compute_experiment_diff(compare_target, exp)

    explanation = AIExplanationService.explain_evolution(
        diff_data=diff_data,
        current_exp=exp,
        baseline_exp=baseline_exp
    )

    return explanation
