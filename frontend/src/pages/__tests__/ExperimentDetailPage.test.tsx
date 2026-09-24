import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ExperimentDetailPage } from '../ExperimentDetailPage';
import { Experiment } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getExperiment: vi.fn(),
    getPipelineGraph: vi.fn(),
    reproduceExperiment: vi.fn(),
    explainExperiment: vi.fn(),
    cancelExperiment: vi.fn(),
  },
}));

import { api } from '../../services/api';

const baseExperiment: Experiment = {
  id: 1,
  project_id: 1,
  dataset_id: 1,
  name: 'Baseline Logistic Regression',
  model_type: 'logistic_regression',
  hyperparameters: {},
  preprocessing_config: { imputer_strategy: 'mean', scaler: 'standard', encoder: 'onehot' },
  feature_selection: ['Pclass', 'Sex', 'Age'],
  target_column: 'Survived',
  random_seed: 42,
  test_size: 0.2,
  cross_validation_folds: 0,
  primary_metric: 'f1',
  status: 'completed',
  duration_ms: 245,
  dataset_fingerprint: 'a1b2c3d4e5f6' + '0'.repeat(52),
  created_at: new Date().toISOString(),
  metrics: [
    { split: 'val', metric_name: 'f1', metric_value: 0.82 },
    { split: 'val', metric_name: 'accuracy', metric_value: 0.79 },
    { split: 'train', metric_name: 'f1', metric_value: 0.9 },
  ],
  artifacts: [
    { artifact_type: 'overfitting', data: { gap: 0.08, is_overfitting: false, severity: 'Low', note: 'Well-balanced generalization.' } },
    { artifact_type: 'feature_importance', data: { importances: [{ feature: 'Sex', importance: 0.6 }] } },
  ],
};

const emptyPipelineGraph = { experiment_id: 1, experiment_name: 'Baseline Logistic Regression', nodes: [], edges: [] };

const noop = () => {};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExperimentDetailPage', () => {
  it('renders validation metrics for a completed experiment', async () => {
    (api.getExperiment as any).mockResolvedValue(baseExperiment);
    (api.getPipelineGraph as any).mockResolvedValue(emptyPipelineGraph);

    render(
      <ExperimentDetailPage
        experimentId={1}
        onBack={noop}
        onNavigateNewBranch={noop}
        onNavigateCompare={noop}
      />
    );

    expect(await screen.findByText('Baseline Logistic Regression')).toBeInTheDocument();
    expect(screen.getByText('0.8200')).toBeInTheDocument(); // F1 (primary metric)
    expect(screen.getByText('0.7900')).toBeInTheDocument(); // Accuracy
    expect(screen.queryByText(/Training in progress/)).not.toBeInTheDocument();
    expect(screen.queryByText('Experiment Failed')).not.toBeInTheDocument();
  });

  it('shows a running state with a cancel button and no metrics for a queued/running experiment', async () => {
    const runningExperiment: Experiment = {
      ...baseExperiment,
      status: 'running',
      metrics: [],
      artifacts: [],
    };
    (api.getExperiment as any).mockResolvedValue(runningExperiment);
    (api.getPipelineGraph as any).mockResolvedValue(emptyPipelineGraph);

    render(
      <ExperimentDetailPage
        experimentId={1}
        onBack={noop}
        onNavigateNewBranch={noop}
        onNavigateCompare={noop}
      />
    );

    expect(await screen.findByText(/Training in progress/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Experiment/i })).toBeInTheDocument();
    // No results sections should render yet -- there's nothing to show.
    expect(screen.queryByText('Validation Performance Metrics')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reproduce Experiment/i })).not.toBeInTheDocument();
  });

  it('shows a clear failure banner with the error message for a failed experiment', async () => {
    const failedExperiment: Experiment = {
      ...baseExperiment,
      status: 'failed',
      error_message: "Unsupported classification model: not_a_real_model",
      metrics: [],
      artifacts: [],
    };
    (api.getExperiment as any).mockResolvedValue(failedExperiment);
    (api.getPipelineGraph as any).mockResolvedValue(emptyPipelineGraph);

    render(
      <ExperimentDetailPage
        experimentId={1}
        onBack={noop}
        onNavigateNewBranch={noop}
        onNavigateCompare={noop}
      />
    );

    expect(await screen.findByText('Experiment Failed')).toBeInTheDocument();
    expect(screen.getByText(/Unsupported classification model/)).toBeInTheDocument();
  });

  it('shows a cancelled banner distinct from the failure banner', async () => {
    const cancelledExperiment: Experiment = {
      ...baseExperiment,
      status: 'cancelled',
      error_message: 'Cancelled by user.',
      metrics: [],
      artifacts: [],
    };
    (api.getExperiment as any).mockResolvedValue(cancelledExperiment);
    (api.getPipelineGraph as any).mockResolvedValue(emptyPipelineGraph);

    render(
      <ExperimentDetailPage
        experimentId={1}
        onBack={noop}
        onNavigateNewBranch={noop}
        onNavigateCompare={noop}
      />
    );

    expect(await screen.findByText('Experiment Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Experiment Failed')).not.toBeInTheDocument();
  });
});
