import numpy as np
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.entities import Experiment, Dataset, Project
from app.services.dataset_analyzer import calculate_file_sha256, load_dataset
from app.services.pipeline_engine import MLPipelineEngine
from app.services.evaluation_engine import EvaluationEngine

class ReproducibilityService:
    """Certifies reproducibility of experimental pipelines using seeds and dataset fingerprints."""

    @classmethod
    def reproduce(
        cls,
        db: Session,
        experiment_id: int,
        tolerance: float = 1e-4
    ) -> Dict[str, Any]:
        exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found.")

        dataset = db.query(Dataset).filter(Dataset.id == exp.dataset_id).first()
        if not dataset:
            raise ValueError("Dataset associated with experiment not found.")

        project = db.query(Project).filter(Project.id == exp.project_id).first()
        task_type = project.task_type if project else "classification"

        # Check fingerprint
        current_hash = calculate_file_sha256(dataset.file_path)
        stored_hash = exp.dataset_fingerprint or dataset.sha256_hash
        dataset_match = (current_hash == stored_hash)

        if not dataset_match:
            return {
                "experiment_id": exp.id,
                "dataset_match": False,
                "stored_fingerprint": stored_hash,
                "current_fingerprint": current_hash,
                "reproduced_successfully": False,
                "within_tolerance": False,
                "tolerance": tolerance,
                "original_metrics": {},
                "reproduced_metrics": {},
                "metric_differences": {},
                "message": "Dataset SHA-256 fingerprint mismatch. The underlying dataset has changed since the original experiment run."
            }

        # Load dataset
        df = load_dataset(dataset.file_path)

        # Rerun exact pipeline with exact seed and config
        pipeline_result = MLPipelineEngine.train_and_evaluate(
            df=df,
            target_column=exp.target_column,
            task_type=task_type,
            model_type=exp.model_type,
            hyperparameters=exp.hyperparameters or {},
            preprocessing_config=exp.preprocessing_config or {},
            feature_columns=exp.feature_selection,
            test_size=exp.test_size or 0.2,
            random_seed=exp.random_seed or 42,
            artifact_save_dir=None
        )

        # Evaluate
        if task_type == "classification":
            classes = list(pipeline_result["label_encoder"].classes_) if pipeline_result["label_encoder"] is not None else None
            eval_result = EvaluationEngine.evaluate_classification(
                y_train=pipeline_result["y_train"],
                y_train_pred=pipeline_result["y_train_pred"],
                y_val=pipeline_result["y_val"],
                y_val_pred=pipeline_result["y_val_pred"],
                y_val_proba=pipeline_result["y_val_proba"],
                classes=classes
            )
        else:
            eval_result = EvaluationEngine.evaluate_regression(
                y_train=pipeline_result["y_train"],
                y_train_pred=pipeline_result["y_train_pred"],
                y_val=pipeline_result["y_val"],
                y_val_pred=pipeline_result["y_val_pred"]
            )

        reproduced_metrics = eval_result["validation_metrics"]
        original_metrics = {m.metric_name: m.metric_value for m in exp.metrics if m.split == "val"}

        metric_diffs = {}
        all_within_tolerance = True

        for k, v_orig in original_metrics.items():
            if k in reproduced_metrics:
                v_rep = reproduced_metrics[k]
                diff = abs(v_orig - v_rep)
                metric_diffs[k] = round(diff, 6)
                if diff > tolerance:
                    all_within_tolerance = False

        if all_within_tolerance:
            message = f"Experiment successfully reproduced! All validation metrics matched original run within specified tolerance (ε = {tolerance})."
        else:
            message = f"Experiment ran successfully, but some metrics differed beyond tolerance (ε = {tolerance}). Check non-deterministic multi-threading or hardware variations."

        return {
            "experiment_id": exp.id,
            "dataset_match": True,
            "stored_fingerprint": stored_hash,
            "current_fingerprint": current_hash,
            "reproduced_successfully": True,
            "within_tolerance": all_within_tolerance,
            "tolerance": tolerance,
            "original_metrics": original_metrics,
            "reproduced_metrics": reproduced_metrics,
            "metric_differences": metric_diffs,
            "message": message
        }
