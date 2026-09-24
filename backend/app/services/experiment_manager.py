import time
import threading
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import pandas as pd

from app.models.entities import Experiment, ExperimentMetric, ExperimentArtifact, Dataset, Project
from app.services.dataset_analyzer import calculate_file_sha256, load_dataset
from app.services.pipeline_engine import MLPipelineEngine
from app.services.evaluation_engine import EvaluationEngine
from app.core.config import settings
from app.db.session import SessionLocal

class ExperimentManager:
    """Manages experiment creation, background execution, persistence, and lineage tracking."""

    # Process-local registry of in-flight experiments' cancel signals, keyed
    # by experiment id. A plain dict is sufficient here (single-process,
    # student-laptop app, no multi-worker deployment) -- this is deliberately
    # not backed by any external queue/broker.
    _cancel_events: Dict[int, threading.Event] = {}
    _timers: Dict[int, threading.Timer] = {}
    _registry_lock = threading.Lock()

    @classmethod
    def run_experiment_background(cls, experiment_id: int, timeout_seconds: int) -> None:
        """Entry point scheduled via FastAPI's BackgroundTasks after the create
        response has already been sent. Owns its own DB session (the request's
        session is closed by the time this runs) and a cancel_event that both
        a manual /cancel call and a wall-clock timeout can signal.
        """
        cancel_event = threading.Event()
        timer = threading.Timer(timeout_seconds, cancel_event.set)
        timer.daemon = True

        with cls._registry_lock:
            cls._cancel_events[experiment_id] = cancel_event
            cls._timers[experiment_id] = timer
        timer.start()

        db = SessionLocal()
        try:
            cls.run_experiment(db=db, experiment_id=experiment_id, cancel_event=cancel_event)
        finally:
            db.close()
            timer.cancel()
            with cls._registry_lock:
                cls._cancel_events.pop(experiment_id, None)
                cls._timers.pop(experiment_id, None)

    @classmethod
    def cancel_experiment(cls, experiment_id: int) -> bool:
        """Best-effort signal to an in-flight run. Returns True if a live
        handle was found and signaled. The caller (the /cancel endpoint) also
        applies a race-safe conditional DB update regardless of this return
        value, so a queued/running experiment is never left stuck even if no
        in-memory handle exists (e.g. after a process restart)."""
        with cls._registry_lock:
            cancel_event = cls._cancel_events.get(experiment_id)
        if cancel_event:
            cancel_event.set()
            return True
        return False

    @classmethod
    def run_experiment(
        cls,
        db: Session,
        experiment_id: int,
        cancel_event: Optional[threading.Event] = None
    ) -> Experiment:
        """Executes an experiment, records its metrics, artifacts, and updates status.

        Cancellation is checkpoint-based, not preemptive: scikit-learn's fit()
        can't be safely interrupted mid-call, so cancel_event is checked (a)
        before any work starts, in case it was cancelled while still queued,
        and (b) right after training/evaluation finish but before anything is
        persisted. Either way, an experiment only ever ends up fully completed
        (with consistent metrics/artifacts) or cleanly cancelled (with none)
        -- never a partial mix of the two.
        """
        exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found.")

        if exp.status == "cancelled" or (cancel_event and cancel_event.is_set()):
            # Already cancelled before this run ever got to start (e.g. the
            # user cancelled while it was still queued behind other work).
            return exp

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

            # Checkpoint: training/evaluation just finished, but nothing has
            # been persisted yet. If cancelled (via the in-memory event, or
            # directly in the DB by a /cancel request that arrived before an
            # in-memory handle existed), discard these results entirely
            # rather than writing a "completed" experiment the user asked to
            # stop -- and never a partial write of only some metrics.
            db.refresh(exp)
            if (cancel_event and cancel_event.is_set()) or exp.status == "cancelled":
                exp.status = "cancelled"
                exp.error_message = exp.error_message or "Cancelled by user."
                exp.duration_ms = int((time.time() - start_time) * 1000)
                db.commit()
                db.refresh(exp)
                return exp

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

            # Learning curve (train-size vs score), computed automatically
            # like the other model diagnostics below -- absent if the
            # dataset was too small or the primary metric has no CV scorer.
            if pipeline_result.get("learning_curve"):
                db.add(ExperimentArtifact(
                    experiment_id=exp.id,
                    artifact_type="learning_curve",
                    data=pipeline_result["learning_curve"]
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
