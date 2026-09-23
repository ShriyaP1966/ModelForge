from typing import Dict, Any, List, Optional
from app.core.config import settings, AI_AVAILABLE_PROVIDERS

class AIExplanationService:
    """Provides natural-language and structured scientific explanations for experiment evolution."""

    @classmethod
    def explain_evolution(
        cls,
        diff_data: Dict[str, Any],
        current_exp: Any,
        baseline_exp: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Generates structured explanation of what changed, why performance shifted, and next steps.

        Only "offline" (the deterministic engine below) is implemented. The
        settings API rejects any other provider before it can ever reach here
        (see settings_api.py), so this branch is a defense-in-depth fallback,
        not the enforcement point -- it guarantees the app always produces an
        explanation, with zero network calls or API costs, regardless of what
        AI_PROVIDER happens to be set to.
        """
        provider = settings.AI_PROVIDER.lower() if settings.AI_PROVIDER else "offline"
        if provider not in AI_AVAILABLE_PROVIDERS:
            provider = "offline"

        return cls._generate_deterministic_explanation(diff_data, current_exp, baseline_exp)

    @classmethod
    def _generate_deterministic_explanation(
        cls,
        diff_data: Dict[str, Any],
        current_exp: Any,
        baseline_exp: Optional[Any] = None
    ) -> Dict[str, Any]:
        what_changed = []
        performance_shifts = []
        hypotheses = []
        limitations = []
        next_experiments = []

        diff_items = diff_data.get("diffs", [])
        metrics_diff = diff_data.get("metrics_diff", [])

        # 1. Summarize configuration changes
        model_changed = False
        scaler_changed = False
        feats_changed = False

        for d in diff_items:
            if d.get("changed"):
                prop = d.get("property")
                prev_val = d.get("previous")
                curr_val = d.get("current")

                if prop == "Model Architecture":
                    model_changed = True
                    what_changed.append(f"Switched model from {prev_val.replace('_', ' ').title()} to {curr_val.replace('_', ' ').title()}.")
                elif "Scaler" in prop:
                    scaler_changed = True
                    what_changed.append(f"Updated feature scaling: {prev_val} -> {curr_val}.")
                elif "Feature Count" in prop:
                    feats_changed = True
                    what_changed.append(f"Modified feature count from {prev_val} to {curr_val}.")
                elif d.get("category") == "Hyperparameters":
                    what_changed.append(f"Tuned hyperparameter '{prop}': {prev_val} -> {curr_val}.")
                else:
                    what_changed.append(f"Changed {prop} from {prev_val} to {curr_val}.")

        if not what_changed:
            what_changed.append("Experiment parameters are identical or this is an initial baseline run.")

        # 2. Summarize metric shifts
        primary_metric = current_exp.primary_metric.lower()
        pm_shift = next((m for m in metrics_diff if m["metric"].lower() == primary_metric), None)
        
        improved_count = sum(1 for m in metrics_diff if m["status"] == "improved")
        declined_count = sum(1 for m in metrics_diff if m["status"] == "declined")

        for m in metrics_diff:
            if m.get("delta") is not None and m.get("status") != "neutral":
                direction = "improved" if m["status"] == "improved" else "dropped"
                pct = f" ({m['pct_change']:+.2f}%)" if m.get("pct_change") is not None else ""
                performance_shifts.append(
                    f"Validation {m['metric'].upper()} {direction} by {abs(m['delta']):.4f}{pct} (from {m['previous']} to {m['current']})."
                )

        if not performance_shifts:
            performance_shifts.append("Metrics remained identical between compared runs.")

        # 3. Formulate grounded hypotheses
        curr_model = current_exp.model_type.lower()
        prev_model = baseline_exp.model_type.lower() if baseline_exp else ""

        if scaler_changed:
            hypotheses.append(
                "Hypothesis: Scaling numerical features standardized gradient magnitudes and prevented high-range features from disproportionately dominating optimization."
            )

        if model_changed:
            if "forest" in curr_model or "gradient_boosting" in curr_model:
                hypotheses.append(
                    "Hypothesis: Tree ensembles natively capture non-linear feature interactions and high-order decision boundaries better than linear models."
                )
            elif "svm" in curr_model:
                hypotheses.append(
                    "Hypothesis: Kernel SVM mapped features into a higher-dimensional space where non-linear separation was more tractable."
                )

        if feats_changed:
            hypotheses.append(
                "Hypothesis: Pruning redundant or weakly correlated features reduced dimensionality noise, enabling the estimator to focus on primary predictive signals."
            )

        if not hypotheses:
            hypotheses.append(
                "Hypothesis: Observed performance variations reflect hyperparameter tuning and optimization landscape adjustments."
            )

        # 4. Assess risks and limitations
        # Check overfitting note
        overfit_art = next((a for a in current_exp.artifacts if a.artifact_type == "overfitting"), None)
        if overfit_art and overfit_art.data:
            if overfit_art.data.get("is_overfitting"):
                limitations.append(
                    f"Overfitting Risk: {overfit_art.data.get('note')} The model may have memorized training idiosyncrasies rather than generalized patterns."
                )
            else:
                limitations.append(
                    "Generalization: Train and validation performance are closely aligned, demonstrating stable regularization."
                )

        limitations.append(
            "Evaluation Boundary: Single train/validation split may exhibit variance; K-Fold cross validation is recommended for final confirmation."
        )

        # 5. Suggested Next Experiments
        if "forest" in curr_model or "tree" in curr_model:
            next_experiments.append("Test regularization by constraining `max_depth` (e.g. 5-10) or increasing `min_samples_split` to curtail overfitting.")
            next_experiments.append("Evaluate feature importances and drop the lowest 25% ranking features to streamline the pipeline.")
        elif "logistic" in curr_model or "linear" in curr_model:
            next_experiments.append("Experiment with L1 (Lasso) or L2 (Ridge) penalty tuning to perform automated feature selection.")
            next_experiments.append("Try a non-linear model such as Random Forest or Gradient Boosting to test if non-linear interactions exist in the feature set.")
        else:
            next_experiments.append("Perform systematic grid search on the leading hyperparameters.")
            next_experiments.append("Validate the pipeline using 5-fold cross-validation to guarantee stability.")

        summary_tone = "advancement" if (pm_shift and pm_shift["status"] == "improved") else ("trade-off or regression" if (pm_shift and pm_shift["status"] == "declined") else "iteration")
        summary = (
            f"Experiment #{current_exp.id} ('{current_exp.name}') represents an evolutionary {summary_tone} "
            f"utilizing {curr_model.replace('_', ' ').title()}. "
            f"{len(what_changed)} key pipeline modifications were observed."
        )

        return {
            "summary": summary,
            "what_changed": what_changed,
            "performance_shifts": performance_shifts,
            "plausible_hypotheses": hypotheses,
            "risks_and_limitations": limitations,
            "suggested_next_experiments": next_experiments,
            "provider": "offline_deterministic"
        }
