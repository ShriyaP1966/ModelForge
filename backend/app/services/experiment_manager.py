import time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import pandas as pd

from app.models.entities import Experiment, ExperimentMetric, ExperimentArtifact, Dataset, Project
from app.services.dataset_analyzer import calculate_file_sha256, load_dataset
from app.services.pipeline_engine import MLPipelineEngine
from app.services.evaluation_engine import EvaluationEngine
from app.core.config import settings

class ExperimentManager:
    """Manages experiment creation, background execution, persistence, and lineage tracking."""

    @classmethod
    def run_experiment(
        cls,
        db: Session,
        experiment_id: int
    ) -> Experiment:
        """Executes an experiment, records its metrics, artifacts, and updates status."""
        exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found.")

        dataset = db.query(Dataset).filter(Dataset.id == exp.dataset_id).first()
        if not dataset:
            exp.status = "failed"
            exp.error_message = "Associated dataset not found."
            db.commit()
            return exp

        project = db.query(Project).filter(Project.id == exp.project_id).first()
        task_type = project.task_type if project else "classification"

        exp.status = "running"
        db.commit()

        start_time = time.time()
        try:
            # 1. Verify dataset fingerprint
            current_hash = calculate_file_sha256(dataset.file_path)
            exp.dataset_fingerprint = current_hash

            # 2. Load dataset
            df = load_dataset(dataset.file_path)

            # 3. Train ML Pipeline
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
                artifact_save_dir=settings.MODELS_DIR,
                cross_validation_folds=exp.cross_validation_folds or 0,
                primary_metric=exp.primary_metric or "f1"
            )

            # 4. Evaluate
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

            # 5. Persist Metrics
            # Clear existing metrics for this experiment if any
            db.query(ExperimentMetric).filter(ExperimentMetric.experiment_id == exp.id).delete()
            
            for m_name, m_val in eval_result["validation_metrics"].items():
                db.add(ExperimentMetric(
                    experiment_id=exp.id,
                    split="val",
                    metric_name=m_name,
                    metric_value=m_val
                ))
            for m_name, m_val in eval_result["training_metrics"].items():
                db.add(ExperimentMetric(
                    experiment_id=exp.id,
                    split="train",
                    metric_name=m_name,
                    metric_value=m_val
                ))

            # 6. Persist Artifacts
            db.query(ExperimentArtifact).filter(ExperimentArtifact.experiment_id == exp.id).delete()

            # Saved pipeline model path
            if pipeline_result.get("saved_model_path"):
                db.add(ExperimentArtifact(
                    experiment_id=exp.id,
                    artifact_type="model",
                    file_path=pipeline_result["saved_model_path"],
                    data={"model_type": exp.model_type}
                ))

            # Feature importances
            if pipeline_result.get("feature_importances"):
                db.add(ExperimentArtifact(
                    experiment_id=exp.id,
                    artifact_type="feature_importance",
                    data={"importances": pipeline_result["feature_importances"]}
                ))

            # Cross-validation summary (only present when cross_validation_folds >= 2)
            if pipeline_result.get("cross_validation"):
                db.add(ExperimentArtifact(
                    experiment_id=exp.id,
                    artifact_type="cross_validation",
                    data=pipeline_result["cross_validation"]
                ))

            # Confusion matrix / curves / residuals
            if task_type == "classification":
                if eval_result.get("confusion_matrix"):
                    db.add(ExperimentArtifact(
                        experiment_id=exp.id,
                        artifact_type="confusion_matrix",
                        data=eval_result["confusion_matrix"]
                    ))
                if eval_result.get("roc_curve"):
                    db.add(ExperimentArtifact(
                        experiment_id=exp.id,
                        artifact_type="roc_curve",
                        data=eval_result["roc_curve"]
                    ))
                if eval_result.get("pr_curve"):
                    db.add(ExperimentArtifact(
                        experiment_id=exp.id,
                        artifact_type="pr_curve",
                        data=eval_result["pr_curve"]
                    ))
            else:
                if eval_result.get("residuals"):
                    db.add(ExperimentArtifact(
                        experiment_id=exp.id,
                        artifact_type="residuals",
                        data={"residuals": eval_result["residuals"]}
                    ))

            # Overfitting diagnosis artifact
            db.add(ExperimentArtifact(
                experiment_id=exp.id,
                artifact_type="overfitting",
                data=eval_result["overfitting"]
            ))

            exp.status = "completed"
            exp.error_message = None
            exp.duration_ms = int((time.time() - start_time) * 1000)

        except Exception as e:
            exp.status = "failed"
            exp.error_message = str(e)
            exp.duration_ms = int((time.time() - start_time) * 1000)

        db.commit()
        db.refresh(exp)
        return exp

    @classmethod
    def get_lineage(cls, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """Constructs experiment lineage tree with primary metric leader identification.

        Includes every experiment in the project regardless of status. Earlier
        this queried `status == "completed"` only, which meant a completed
        child experiment whose parent was still queued/running/failed had its
        parent silently excluded from the result -- the frontend lineage tree
        builds itself from parent/child pointers within this same list, so an
        excluded parent made the (otherwise valid, completed) child unreachable
        and it disappeared from the tree entirely. Leader selection still only
        considers completed runs with a recorded primary-metric value.
        """
        experiments = db.query(Experiment).filter(
            Experiment.project_id == project_id
        ).order_by(Experiment.id.asc()).all()

        if not experiments:
            return []

        # Find best performing experiment (leader) based on primary metric
        leader_id = None
        best_val = None

        node_list = []
        for exp in experiments:
            # Only completed runs have a trustworthy primary-metric value.
            val = None
            if exp.status == "completed":
                pm_metric = next((m for m in exp.metrics if m.split == "val" and m.metric_name.lower() == exp.primary_metric.lower()), None)
                val = pm_metric.metric_value if pm_metric else None

                if val is not None:
                    is_better = False
                    # Higher is better for accuracy, f1, precision, recall, r2, roc_auc
                    # Lower is better for mae, mse, rmse
                    higher_is_better = exp.primary_metric.lower() not in ["mae", "mse", "rmse"]
                    if best_val is None:
                        is_better = True
                    elif higher_is_better and val > best_val:
                        is_better = True
                    elif not higher_is_better and val < best_val:
                        is_better = True

                    if is_better:
                        best_val = val
                        leader_id = exp.id

            node_list.append({
                "id": exp.id,
                "name": exp.name,
                "parent_id": exp.parent_id,
                "model_type": exp.model_type,
                "primary_metric": exp.primary_metric,
                "primary_metric_val": val,
                "status": exp.status,
                "created_at": exp.created_at.isoformat(),
                "is_leader": False
            })

        for node in node_list:
            if node["id"] == leader_id:
                node["is_leader"] = True

        return node_list

    @classmethod
    def get_evolution_timeline(cls, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """Returns ordered sequential experiment timeline for evolution charts and replay."""
        experiments = db.query(Experiment).filter(
            Experiment.project_id == project_id,
            Experiment.status == "completed"
        ).order_by(Experiment.id.asc()).all()

        timeline = []
        for exp in experiments:
            val_metrics = {m.metric_name: m.metric_value for m in exp.metrics if m.split == "val"}
            train_metrics = {m.metric_name: m.metric_value for m in exp.metrics if m.split == "train"}
            
            # Find overfitting note if exists
            overfit_art = next((a for a in exp.artifacts if a.artifact_type == "overfitting"), None)
            overfit_data = overfit_art.data if overfit_art else {}

            timeline.append({
                "id": exp.id,
                "name": exp.name,
                "parent_id": exp.parent_id,
                "model_type": exp.model_type,
                "hyperparameters": exp.hyperparameters,
                "preprocessing_config": exp.preprocessing_config,
                "feature_selection": exp.feature_selection,
                "primary_metric": exp.primary_metric,
                "validation_metrics": val_metrics,
                "training_metrics": train_metrics,
                "overfitting": overfit_data,
                "duration_ms": exp.duration_ms,
                "created_at": exp.created_at.isoformat()
            })

        return timeline
