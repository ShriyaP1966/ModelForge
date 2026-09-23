from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.schemas import ReproduceRequest, ReproduceResponse
from app.services.reproducibility_service import ReproducibilityService

router = APIRouter()

@router.post("/", response_model=ReproduceResponse)
def reproduce_experiment(payload: ReproduceRequest, db: Session = Depends(get_db)):
    try:
        result = ReproducibilityService.reproduce(
            db=db,
            experiment_id=payload.experiment_id,
            tolerance=payload.tolerance
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reproducibility run failed: {str(e)}")
