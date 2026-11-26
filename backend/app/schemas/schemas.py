import datetime
from typing import Any

from pydantic import BaseModel, Field


# --- Project Schemas ---
class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    task_type: str = "classification"  # classification or regression

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    dataset_count: int = 0
    experiment_count: int = 0

    class Config:
        from_attributes = True

# --- Dataset Schemas ---
class DatasetResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    row_count: int
    col_count: int
    sha256_hash: str
    target_column: str | None = None
    summary_stats: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ColumnSummary(BaseModel):
    name: str
    dtype: str
    inferred_type: str  # numeric, categorical, boolean, datetime, id, text
    missing_count: int
    missing_pct: float
    unique_count: int
    is_constant: bool
    is_potential_target: bool
    is_potential_leakage: bool
    leakage_reasons: list[str] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)  # min, max, mean, std, quantiles, top categories
    outlier_count: int = 0

class DatasetHealthReport(BaseModel):
    row_count: int
    col_count: int
    duplicate_rows: int
    total_missing_cells: int
    missing_pct: float
    health_score: float  # 0 to 100
    health_status: str  # Excellent, Good, Fair, Critical
    columns: list[ColumnSummary]
    potential_targets: list[str]
    leakage_warnings: list[dict[str, Any]]
    correlation_matrix: dict[str, dict[str, float]]
    class_balance: dict[str, int] | None = None
    summary_notes: list[str] = Field(default_factory=list)

# --- Experiment Schemas ---
class PreprocessingConfig(BaseModel):
    imputer_strategy: str = "mean"  # mean, median, most_frequent, constant
    scaler: str = "standard"  # standard, minmax, robust, none
    encoder: str = "onehot"  # onehot, ordinal

class ExperimentCreate(BaseModel):
    project_id: int
    dataset_id: int
    parent_id: int | None = None
    name: str
    description: str | None = None
    model_type: str  # e.g. "logistic_regression", "random_forest", "linear_regression", etc.
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    preprocessing_config: PreprocessingConfig = Field(default_factory=PreprocessingConfig)
    feature_selection: list[str] | None = None  # None = use all valid features
    target_column: str
    random_seed: int = 42
    test_size: float = 0.2
    cross_validation_folds: int = 0
    primary_metric: str = "f1"  # f1, accuracy, roc_auc, precision, recall, rmse, mae, r2

class ExperimentMetricResponse(BaseModel):
    split: str
    metric_name: str
    metric_value: float

    class Config:
        from_attributes = True

class ExperimentArtifactResponse(BaseModel):
    artifact_type: str
    file_path: str | None = None
    data: dict[str, Any] | None = None

    class Config:
        from_attributes = True

class ExperimentResponse(BaseModel):
    id: int
    project_id: int
    dataset_id: int | None = None
    parent_id: int | None = None
    name: str
    description: str | None = None
    model_type: str
    hyperparameters: dict[str, Any]
    preprocessing_config: dict[str, Any]
    feature_selection: list[str]
    target_column: str
    random_seed: int
    test_size: float
    cross_validation_folds: int
    primary_metric: str
    status: str
    duration_ms: int
    error_message: str | None = None
    dataset_fingerprint: str | None = None
    created_at: datetime.datetime
    metrics: list[ExperimentMetricResponse] = Field(default_factory=list)
    artifacts: list[ExperimentArtifactResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

# --- Diff & Lineage Schemas ---
class DiffItem(BaseModel):
    category: str  # model, hyperparameters, preprocessing, features, metrics
    property: str
    previous: Any
    current: Any
    changed: bool
    impact_note: str | None = None

class ExperimentDiffResponse(BaseModel):
    experiment_a: dict[str, Any]
    experiment_b: dict[str, Any]
    diffs: list[DiffItem]
    metrics_diff: list[dict[str, Any]]

class LineageNode(BaseModel):
    id: int
    name: str
    parent_id: int | None
    model_type: str
    primary_metric: str
    primary_metric_val: float | None
    status: str
    created_at: datetime.datetime
    is_leader: bool = False

# --- Reproduce Schemas ---
class ReproduceRequest(BaseModel):
    experiment_id: int
    tolerance: float = 1e-4

class ReproduceResponse(BaseModel):
    experiment_id: int
    dataset_match: bool
    stored_fingerprint: str
    current_fingerprint: str
    reproduced_successfully: bool
    within_tolerance: bool
    tolerance: float
    original_metrics: dict[str, float]
    reproduced_metrics: dict[str, float]
    metric_differences: dict[str, float]
    message: str

# --- AI Explanation Schemas ---
class AIExplainRequest(BaseModel):
    experiment_id: int
    baseline_experiment_id: int | None = None

class AIExplainResponse(BaseModel):
    summary: str
    what_changed: list[str]
    performance_shifts: list[str]
    plausible_hypotheses: list[str]
    risks_and_limitations: list[str]
    suggested_next_experiments: list[str]
    provider: str  # offline_deterministic, openai, gemini
