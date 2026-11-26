import csv
import io
import json
from typing import Any

from app.models.entities import Experiment
from app.schemas.schemas import ExperimentResponse

# Spreadsheet apps treat cells starting with these characters as formulas.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value: Any) -> Any:
    """Neutralize spreadsheet formula injection in user-supplied text cells."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def _md_cell(value: Any) -> str:
    """Escape a value for use inside a Markdown table cell."""
    return str(value).replace("|", "\\|").replace("\n", " ")


class ExportService:
    """Builds downloadable JSON, CSV and Markdown representations of experiments."""

    @staticmethod
    def experiment_to_dict(exp: Experiment) -> dict[str, Any]:
        """Full experiment record. Server-side file paths of saved models are omitted."""
        data = ExperimentResponse.model_validate(exp).model_dump(mode="json")
        for artifact in data["artifacts"]:
            artifact.pop("file_path", None)
        return data

    @classmethod
    def experiment_json(cls, exp: Experiment) -> str:
        return json.dumps(cls.experiment_to_dict(exp), indent=2)

    @classmethod
    def project_runs_json(cls, experiments: list[Experiment]) -> str:
        return json.dumps([cls.experiment_to_dict(e) for e in experiments], indent=2)

    @staticmethod
    def project_runs_csv(experiments: list[Experiment]) -> str:
        """One row per run: configuration columns followed by train_/val_ metric columns."""
        metric_columns: list[str] = []
        for exp in experiments:
            for m in exp.metrics:
                col = f"{m.split}_{m.metric_name}"
                if col not in metric_columns:
                    metric_columns.append(col)
        metric_columns.sort()

        base_columns = [
            "id", "name", "parent_id", "status", "model_type", "dataset_id", "dataset_fingerprint",
            "target_column", "test_size", "cross_validation_folds", "random_seed", "primary_metric",
            "duration_ms", "created_at", "hyperparameters", "preprocessing_config",
        ]
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(base_columns + metric_columns)

        for exp in experiments:
            metrics = {f"{m.split}_{m.metric_name}": m.metric_value for m in exp.metrics}
            row = [
                exp.id, exp.name, exp.parent_id, exp.status, exp.model_type, exp.dataset_id,
                exp.dataset_fingerprint, exp.target_column, exp.test_size, exp.cross_validation_folds,
                exp.random_seed, exp.primary_metric, exp.duration_ms,
                exp.created_at.isoformat() if exp.created_at else "",
                json.dumps(exp.hyperparameters or {}, sort_keys=True),
                json.dumps(exp.preprocessing_config or {}, sort_keys=True),
            ]
            row = [_csv_safe(v) for v in row]
            row += [metrics.get(col, "") for col in metric_columns]
            writer.writerow(row)
        return buffer.getvalue()

    @staticmethod
    def experiment_report(exp: Experiment) -> str:
        """A short human-readable Markdown report for one experiment."""
        artifacts = {a.artifact_type: a.data for a in exp.artifacts}
        lines = [
            f"# {exp.name}",
            "",
            f"- **Status:** {exp.status}",
            f"- **Model:** {exp.model_type}",
            f"- **Target column:** {exp.target_column}",
            f"- **Primary metric:** {exp.primary_metric}",
            f"- **Parent experiment:** {('#' + str(exp.parent_id)) if exp.parent_id else 'none (baseline)'}",
            f"- **Run time:** {exp.duration_ms} ms",
            "",
            "## Reproducibility",
            "",
            f"- Dataset fingerprint (SHA-256): `{exp.dataset_fingerprint or 'not recorded'}`",
            f"- Random seed: {exp.random_seed}",
            f"- Validation split: {exp.test_size}",
            f"- Cross-validation folds: {exp.cross_validation_folds or 'none'}",
            "",
        ]

        if exp.description:
            lines[2:2] = [exp.description, ""]

        if exp.hyperparameters:
            lines += ["## Hyperparameters", "", "| Parameter | Value |", "|---|---|"]
            lines += [f"| {_md_cell(k)} | {_md_cell(v)} |" for k, v in sorted(exp.hyperparameters.items())]
            lines.append("")

        if exp.preprocessing_config:
            lines += ["## Preprocessing", "", "| Step | Setting |", "|---|---|"]
            lines += [f"| {_md_cell(k)} | {_md_cell(v)} |" for k, v in sorted(exp.preprocessing_config.items())]
            lines.append("")

        if exp.error_message:
            lines += ["## Error", "", exp.error_message, ""]

        by_name: dict[str, dict[str, float]] = {}
        for m in exp.metrics:
            by_name.setdefault(m.metric_name, {})[m.split] = m.metric_value
        if by_name:
            lines += ["## Metrics", "", "| Metric | Train | Validation |", "|---|---|---|"]
            for name in sorted(by_name):
                train = by_name[name].get("train")
                val = by_name[name].get("val")
                lines.append(
                    f"| {_md_cell(name)} | {'' if train is None else f'{train:.4f}'} "
                    f"| {'' if val is None else f'{val:.4f}'} |"
                )
            lines.append("")

        overfit = artifacts.get("overfitting")
        if overfit and overfit.get("note"):
            lines += ["## Generalization", "", overfit["note"], ""]

        per_class = (artifacts.get("per_class_metrics") or {}).get("classes")
        if per_class:
            lines += ["## Per-class metrics", "", "| Class | Precision | Recall | F1 | Support |", "|---|---|---|---|---|"]
            lines += [
                f"| {_md_cell(c['label'])} | {c['precision']:.3f} | {c['recall']:.3f} | {c['f1']:.3f} | {c['support']} |"
                for c in per_class
            ]
            lines.append("")

        cm = artifacts.get("confusion_matrix")
        if cm and cm.get("matrix"):
            labels = [_md_cell(label) for label in cm["labels"]]
            lines += [
                "## Confusion matrix (rows: true class, columns: predicted)",
                "",
                "| | " + " | ".join(labels) + " |",
                "|---|" + "---|" * len(labels),
            ]
            lines += [f"| **{labels[i]}** | " + " | ".join(str(v) for v in row) + " |" for i, row in enumerate(cm["matrix"])]
            lines.append("")

        importances = (artifacts.get("feature_importance") or {}).get("importances")
        if importances:
            top = sorted(importances, key=lambda item: item["importance"], reverse=True)[:10]
            lines += ["## Top features", "", "| Feature | Importance |", "|---|---|"]
            lines += [f"| {_md_cell(item['feature'])} | {item['importance']:.4f} |" for item in top]
            lines.append("")

        return "\n".join(lines).rstrip() + "\n"
