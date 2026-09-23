export interface Project {
  id: number;
  name: string;
  description?: string;
  task_type: 'classification' | 'regression';
  created_at: string;
  updated_at: string;
  dataset_count: number;
  experiment_count: number;
}

export interface Dataset {
  id: number;
  project_id: number;
  filename: string;
  row_count: number;
  col_count: number;
  sha256_hash: string;
  target_column?: string;
  summary_stats: any;
  created_at: string;
}

export interface ColumnHistogram {
  bin_edges: number[];
  counts: number[];
}

export interface ColumnStats {
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  median?: number;
  q25?: number;
  q75?: number;
  histogram?: ColumnHistogram;
  top_categories?: Record<string, number>;
}

export interface ColumnSummary {
  name: string;
  dtype: string;
  inferred_type: string;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  is_constant: boolean;
  is_potential_target: boolean;
  is_potential_leakage: boolean;
  leakage_reasons: string[];
  stats: ColumnStats;
  outlier_count: number;
}

export interface DatasetHealthReport {
  row_count: number;
  col_count: number;
  duplicate_rows: number;
  total_missing_cells: number;
  missing_pct: number;
  health_score: number;
  health_status: 'Excellent' | 'Good' | 'Fair' | 'Critical';
  columns: ColumnSummary[];
  potential_targets: string[];
  leakage_warnings: Array<{ column: string; reasons: string[]; risk: string }>;
  correlation_matrix: Record<string, Record<string, number>>;
  class_balance?: Record<string, number>;
  summary_notes: string[];
}

export interface ExperimentMetric {
  split: 'train' | 'val' | 'cv';
  metric_name: string;
  metric_value: number;
}

export interface ExperimentArtifact {
  artifact_type: string;
  file_path?: string;
  data?: any;
}

export interface CrossValidationResult {
  requested_folds: number;
  effective_folds: number | null;
  metric: string;
  scores: number[];
  mean: number | null;
  std: number | null;
  error: string | null;
}

export interface Experiment {
  id: number;
  project_id: number;
  dataset_id: number;
  parent_id?: number;
  name: string;
  description?: string;
  model_type: string;
  hyperparameters: Record<string, any>;
  preprocessing_config: {
    imputer_strategy: string;
    scaler: string;
    encoder: string;
  };
  feature_selection: string[];
  target_column: string;
  random_seed: number;
  test_size: number;
  cross_validation_folds: number;
  primary_metric: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  duration_ms: number;
  error_message?: string;
  dataset_fingerprint?: string;
  created_at: string;
  metrics: ExperimentMetric[];
  artifacts: ExperimentArtifact[];
}

export interface LineageNode {
  id: number;
  name: string;
  parent_id: number | null;
  model_type: string;
  primary_metric: string;
  primary_metric_val: number | null;
  status: string;
  created_at: string;
  is_leader: boolean;
}

export interface DiffItem {
  category: string;
  property: string;
  previous: any;
  current: any;
  changed: boolean;
  impact_note?: string;
}

export interface MetricDiff {
  metric: string;
  previous: number;
  current: number;
  delta: number;
  pct_change: number;
  status: 'improved' | 'declined' | 'neutral';
}

export interface ExperimentDiffResponse {
  experiment_a: { id: number; name: string; model_type: string };
  experiment_b: { id: number; name: string; model_type: string };
  diffs: DiffItem[];
  metrics_diff: MetricDiff[];
}

export interface ReproduceResponse {
  experiment_id: number;
  dataset_match: boolean;
  stored_fingerprint: string;
  current_fingerprint: string;
  reproduced_successfully: boolean;
  within_tolerance: boolean;
  tolerance: number;
  original_metrics: Record<string, number>;
  reproduced_metrics: Record<string, number>;
  metric_differences: Record<string, number>;
  message: string;
}

export interface AIExplainResponse {
  summary: string;
  what_changed: string[];
  performance_shifts: string[];
  plausible_hypotheses: string[];
  risks_and_limitations: string[];
  suggested_next_experiments: string[];
  provider: string;
}
