import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, roc_curve, precision_recall_curve,
    mean_absolute_error, mean_squared_error, r2_score, explained_variance_score
)

class EvaluationEngine:
    """Computes comprehensive classification and regression metrics, curves, and overfitting diagnostics."""

    @classmethod
    def evaluate_classification(
        cls,
        y_train: np.ndarray,
        y_train_pred: np.ndarray,
        y_val: np.ndarray,
        y_val_pred: np.ndarray,
        y_val_proba: Optional[np.ndarray] = None,
        classes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Calculates classification metrics, confusion matrix, ROC/PR curves, and overfitting gap."""
        # Validation metrics
        val_acc = float(accuracy_score(y_val, y_val_pred))
        val_prec = float(precision_score(y_val, y_val_pred, average="weighted", zero_division=0))
        val_rec = float(recall_score(y_val, y_val_pred, average="weighted", zero_division=0))
        val_f1 = float(f1_score(y_val, y_val_pred, average="weighted", zero_division=0))
        
        # Training metrics for overfitting gap
        train_acc = float(accuracy_score(y_train, y_train_pred))
        train_f1 = float(f1_score(y_train, y_train_pred, average="weighted", zero_division=0))
        train_prec = float(precision_score(y_train, y_train_pred, average="weighted", zero_division=0))
        train_rec = float(recall_score(y_train, y_train_pred, average="weighted", zero_division=0))

        # Full label space for this experiment. Falls back to the union of classes
        # actually observed in train/val when no explicit label encoder classes are
        # supplied (e.g. direct unit-test calls).
        if classes is not None:
            full_label_ids: List[Any] = list(range(len(classes)))
            class_labels = [str(c) for c in classes]
        else:
            observed = sorted(set(np.unique(y_train).tolist()) | set(np.unique(y_val).tolist()))
            full_label_ids = observed
            class_labels = [str(c) for c in observed]

        # ROC-AUC calculation
        val_roc_auc = None
        unique_classes = np.unique(y_val)
        if y_val_proba is not None:
            try:
                if len(unique_classes) == 2:
                    # Binary classification
                    proba_col = y_val_proba[:, 1] if y_val_proba.shape[1] > 1 else y_val_proba[:, 0]
                    val_roc_auc = float(roc_auc_score(y_val, proba_col))
                elif len(unique_classes) > 2 and y_val_proba.shape[1] == len(unique_classes):
                    # Multiclass OvR
                    val_roc_auc = float(roc_auc_score(y_val, y_val_proba, multi_class="ovr", average="weighted"))
            except Exception:
                val_roc_auc = None

        # Overfitting Analysis
        gap = round(train_f1 - val_f1, 4)
        is_overfitting = gap > 0.15
        overfitting_severity = "High" if gap > 0.25 else ("Moderate" if gap > 0.15 else "Low")
        overfitting_note = (
            f"Training F1 ({train_f1:.3f}) exceeds Validation F1 ({val_f1:.3f}) by {gap:.3f}. "
            f"Indicates {overfitting_severity.lower()} risk of overfitting."
            if is_overfitting else
            f"Well-balanced generalization: Training F1 ({train_f1:.3f}) vs Validation F1 ({val_f1:.3f}) gap is {gap:.3f}."
        )

        # Confusion Matrix. Always sized to the full label space (via explicit
        # `labels=`) so the matrix never collapses to a smaller shape than
        # `class_labels` when a class is absent from y_val or from predictions
        # (common on tiny/imbalanced validation splits).
        cm = confusion_matrix(y_val, y_val_pred, labels=full_label_ids)
        cm_list = cm.tolist()

        # ROC & PR Curves (binary case)
        roc_data = None
        pr_data = None
        if len(unique_classes) == 2 and y_val_proba is not None:
            try:
                proba_col = y_val_proba[:, 1] if y_val_proba.shape[1] > 1 else y_val_proba[:, 0]
                fpr, tpr, roc_thresh = roc_curve(y_val, proba_col)
                # Sample down points for lightweight visual transmission
                step = max(1, len(fpr) // 50)
                roc_data = {
                    "fpr": [round(float(x), 4) for x in fpr[::step]],
                    "tpr": [round(float(x), 4) for x in tpr[::step]],
                    "auc": round(val_roc_auc, 4) if val_roc_auc is not None else None
                }

                prec, rec, pr_thresh = precision_recall_curve(y_val, proba_col)
                step_pr = max(1, len(prec) // 50)
                pr_data = {
                    "precision": [round(float(x), 4) for x in prec[::step_pr]],
                    "recall": [round(float(x), 4) for x in rec[::step_pr]]
                }
            except Exception:
                pass

        val_metrics = {
            "accuracy": round(val_acc, 4),
            "precision": round(val_prec, 4),
            "recall": round(val_rec, 4),
            "f1": round(val_f1, 4),
        }
        if val_roc_auc is not None:
            val_metrics["roc_auc"] = round(val_roc_auc, 4)

        train_metrics = {
            "accuracy": round(train_acc, 4),
            "precision": round(train_prec, 4),
            "recall": round(train_rec, 4),
            "f1": round(train_f1, 4),
        }

        return {
            "validation_metrics": val_metrics,
            "training_metrics": train_metrics,
            "overfitting": {
                "gap": gap,
                "is_overfitting": is_overfitting,
                "severity": overfitting_severity,
                "note": overfitting_note
            },
            "confusion_matrix": {
                "matrix": cm_list,
                "labels": class_labels
            },
            "roc_curve": roc_data,
            "pr_curve": pr_data
        }

    @classmethod
    def evaluate_regression(
        cls,
        y_train: np.ndarray,
        y_train_pred: np.ndarray,
        y_val: np.ndarray,
        y_val_pred: np.ndarray
    ) -> Dict[str, Any]:
        """Calculates regression metrics (MAE, MSE, RMSE, R²), residuals, and generalization gap."""
        val_mae = float(mean_absolute_error(y_val, y_val_pred))
        val_mse = float(mean_squared_error(y_val, y_val_pred))
        val_rmse = float(np.sqrt(val_mse))
        val_r2 = float(r2_score(y_val, y_val_pred))
        val_ev = float(explained_variance_score(y_val, y_val_pred))

        train_mae = float(mean_absolute_error(y_train, y_train_pred))
        train_mse = float(mean_squared_error(y_train, y_train_pred))
        train_rmse = float(np.sqrt(train_mse))
        train_r2 = float(r2_score(y_train, y_train_pred))

        # Overfitting Analysis for regression (Train R² vs Val R²)
        r2_gap = round(train_r2 - val_r2, 4)
        is_overfitting = r2_gap > 0.20
        overfitting_severity = "High" if r2_gap > 0.35 else ("Moderate" if r2_gap > 0.20 else "Low")
        overfitting_note = (
            f"Training R² ({train_r2:.3f}) exceeds Validation R² ({val_r2:.3f}) by {r2_gap:.3f}. "
            f"Indicates {overfitting_severity.lower()} risk of overfitting."
            if is_overfitting else
            f"Healthy generalization: Train R² ({train_r2:.3f}) vs Val R² ({val_r2:.3f}) gap is {r2_gap:.3f}."
        )

        # Residuals scatter preview (sampled down for visual performance)
        sample_size = min(60, len(y_val))
        indices = np.random.choice(len(y_val), sample_size, replace=False) if len(y_val) > sample_size else range(len(y_val))
        residuals = []
        for idx in indices:
            act = float(y_val[idx])
            pred = float(y_val_pred[idx])
            residuals.append({
                "actual": round(act, 4),
                "predicted": round(pred, 4),
                "residual": round(pred - act, 4)
            })

        val_metrics = {
            "mae": round(val_mae, 4),
            "mse": round(val_mse, 4),
            "rmse": round(val_rmse, 4),
            "r2": round(val_r2, 4),
            "explained_variance": round(val_ev, 4)
        }

        train_metrics = {
            "mae": round(train_mae, 4),
            "mse": round(train_mse, 4),
            "rmse": round(train_rmse, 4),
            "r2": round(train_r2, 4)
        }

        return {
            "validation_metrics": val_metrics,
            "training_metrics": train_metrics,
            "overfitting": {
                "gap": r2_gap,
                "is_overfitting": is_overfitting,
                "severity": overfitting_severity,
                "note": overfitting_note
            },
            "residuals": residuals
        }
