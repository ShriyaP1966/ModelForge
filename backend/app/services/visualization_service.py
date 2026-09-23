from typing import Dict, Any, List, Optional

class VisualizationService:
    """Provides structured graph schemas and side-by-side diff computations for frontend rendering."""

    @classmethod
    def generate_pipeline_graph(cls, experiment: Any) -> Dict[str, Any]:
        """Generates nodes and edges representing the exact executed ML pipeline."""
        prep = experiment.preprocessing_config or {}
        model_type = experiment.model_type or "model"
        params = experiment.hyperparameters or {}
        features = experiment.feature_selection or []
        
        nodes = []
        edges = []

        # 1. Dataset Node
        nodes.append({
            "id": "node_dataset",
            "type": "data",
            "title": "Raw Dataset",
            "subtitle": f"Target: {experiment.target_column}",
            "details": {
                "total_features": len(features) if features else "All",
                "random_seed": experiment.random_seed
            }
        })

        # 2. Imputation Node
        nodes.append({
            "id": "node_imputer",
            "type": "preprocessing",
            "title": "Missing Imputation",
            "subtitle": f"Strategy: {prep.get('imputer_strategy', 'mean')}",
            "details": {
                "numeric_strategy": prep.get("imputer_strategy", "mean"),
                "categorical_strategy": "most_frequent"
            }
        })
        edges.append({"source": "node_dataset", "target": "node_imputer", "label": "Raw Features"})

        # 3. Scaling & Encoding Node
        scaler = prep.get("scaler", "standard")
        encoder = prep.get("encoder", "onehot")
        nodes.append({
            "id": "node_transform",
            "type": "preprocessing",
            "title": "Scaling & Encoding",
            "subtitle": f"{scaler.title()} Scaler | {encoder.upper()} Encoder",
            "details": {
                "scaler": scaler,
                "encoder": encoder
            }
        })
        edges.append({"source": "node_imputer", "target": "node_transform", "label": "Cleaned Data"})

        # 4. Feature Selection Node
        nodes.append({
            "id": "node_features",
            "type": "features",
            "title": "Feature Space",
            "subtitle": f"{len(features)} Selected Columns" if features else "All Available Columns",
            "details": {
                "feature_list": features[:10] + (["..."] if len(features) > 10 else [])
            }
        })
        edges.append({"source": "node_transform", "target": "node_features", "label": "Transformed Matrix"})

        # 5. Model Estimator Node
        nodes.append({
            "id": "node_model",
            "type": "model",
            "title": model_type.replace("_", " ").title(),
            "subtitle": f"Estimator ({experiment.status})",
            "details": params
        })
        edges.append({"source": "node_features", "target": "node_model", "label": "Train Vectors"})

        # 6. Evaluation Node
        val_metrics = {m.metric_name: m.metric_value for m in experiment.metrics if m.split == "val"}
        pm_val = val_metrics.get(experiment.primary_metric.lower())
        nodes.append({
            "id": "node_eval",
            "type": "evaluation",
            "title": "Evaluation",
            "subtitle": f"{experiment.primary_metric.upper()}: {pm_val}" if pm_val is not None else "Metrics Computed",
            "details": val_metrics
        })
        edges.append({"source": "node_model", "target": "node_eval", "label": "Predictions"})

        return {
            "experiment_id": experiment.id,
            "experiment_name": experiment.name,
            "nodes": nodes,
            "edges": edges
        }

    @classmethod
    def compute_experiment_diff(cls, exp_a: Any, exp_b: Any) -> Dict[str, Any]:
        """Calculates precise side-by-side configuration and metric diff between two experiments."""
        diff_items = []

        # Model Family
        diff_items.append({
            "category": "Model",
            "property": "Model Architecture",
            "previous": exp_a.model_type,
            "current": exp_b.model_type,
            "changed": exp_a.model_type != exp_b.model_type,
            "impact_note": "Algorithm class changed" if exp_a.model_type != exp_b.model_type else "Identical architecture"
        })

        # Preprocessing
        prep_a = exp_a.preprocessing_config or {}
        prep_b = exp_b.preprocessing_config or {}
        for key in ["scaler", "imputer_strategy", "encoder"]:
            val_a = prep_a.get(key, "default")
            val_b = prep_b.get(key, "default")
            diff_items.append({
                "category": "Preprocessing",
                "property": key.replace("_", " ").title(),
                "previous": str(val_a),
                "current": str(val_b),
                "changed": val_a != val_b,
                "impact_note": f"Preprocessing modified from {val_a} to {val_b}" if val_a != val_b else "Unchanged"
            })

        # Features
        feats_a = set(exp_a.feature_selection or [])
        feats_b = set(exp_b.feature_selection or [])
        diff_items.append({
            "category": "Features",
            "property": "Feature Count",
            "previous": len(feats_a) if feats_a else "All",
            "current": len(feats_b) if feats_b else "All",
            "changed": feats_a != feats_b,
            "impact_note": f"Added: {list(feats_b - feats_a)}, Removed: {list(feats_a - feats_b)}" if feats_a != feats_b else "Unchanged"
        })

        # Hyperparameters
        params_a = exp_a.hyperparameters or {}
        params_b = exp_b.hyperparameters or {}
        all_param_keys = sorted(list(set(params_a.keys()) | set(params_b.keys())))
        for p in all_param_keys:
            pv_a = params_a.get(p)
            pv_b = params_b.get(p)
            diff_items.append({
                "category": "Hyperparameters",
                "property": p,
                "previous": pv_a if pv_a is not None else "None",
                "current": pv_b if pv_b is not None else "None",
                "changed": pv_a != pv_b,
                "impact_note": f"Hyperparameter {p} altered" if pv_a != pv_b else "Unchanged"
            })

        # Random Seed & Test Size
        diff_items.append({
            "category": "Setup",
            "property": "Random Seed",
            "previous": exp_a.random_seed,
            "current": exp_b.random_seed,
            "changed": exp_a.random_seed != exp_b.random_seed,
            "impact_note": "Seed altered" if exp_a.random_seed != exp_b.random_seed else "Identical seed"
        })

        # Metrics Diff
        metrics_a = {m.metric_name: m.metric_value for m in exp_a.metrics if m.split == "val"}
        metrics_b = {m.metric_name: m.metric_value for m in exp_b.metrics if m.split == "val"}

        all_metric_keys = sorted(list(set(metrics_a.keys()) | set(metrics_b.keys())))
        metrics_diff = []

        higher_is_better_set = {"accuracy", "f1", "precision", "recall", "roc_auc", "r2", "explained_variance"}

        for m_key in all_metric_keys:
            val_a = metrics_a.get(m_key)
            val_b = metrics_b.get(m_key)

            if val_a is not None and val_b is not None:
                delta = round(val_b - val_a, 4)
                pct_change = round(((val_b - val_a) / abs(val_a)) * 100, 2) if val_a != 0 else 0.0
                higher_is_better = m_key.lower() in higher_is_better_set
                
                if delta == 0:
                    status = "neutral"
                elif (higher_is_better and delta > 0) or (not higher_is_better and delta < 0):
                    status = "improved"
                else:
                    status = "declined"

                metrics_diff.append({
                    "metric": m_key,
                    "previous": val_a,
                    "current": val_b,
                    "delta": delta,
                    "pct_change": pct_change,
                    "status": status
                })
            else:
                metrics_diff.append({
                    "metric": m_key,
                    "previous": val_a,
                    "current": val_b,
                    "delta": None,
                    "pct_change": None,
                    "status": "neutral"
                })

        return {
            "experiment_a": {
                "id": exp_a.id,
                "name": exp_a.name,
                "model_type": exp_a.model_type
            },
            "experiment_b": {
                "id": exp_b.id,
                "name": exp_b.name,
                "model_type": exp_b.model_type
            },
            "diffs": diff_items,
            "metrics_diff": metrics_diff
        }
