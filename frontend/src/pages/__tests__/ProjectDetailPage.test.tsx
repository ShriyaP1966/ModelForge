import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ProjectDetailPage } from '../ProjectDetailPage';
import { Experiment, Project } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getProject: vi.fn(),
    getProjectDatasets: vi.fn(),
    getProjectExperiments: vi.fn(),
    getLineage: vi.fn(),
    getEvolution: vi.fn(),
    deleteExperiment: vi.fn(),
  },
}));

import { api } from '../../services/api';

const project: Project = {
  id: 1,
  name: 'Titanic Passenger Survival',
  task_type: 'classification',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  dataset_count: 1,
  experiment_count: 1,
};

const experiment = (status: Experiment['status']): Experiment => ({
  id: 1,
  project_id: 1,
  dataset_id: 1,
  name: 'Baseline: logistic regression',
  model_type: 'logistic_regression',
  hyperparameters: {},
  preprocessing_config: { imputer_strategy: 'mean', scaler: 'none', encoder: 'onehot' },
  feature_selection: [],
  target_column: 'Survived',
  random_seed: 42,
  test_size: 0.25,
  cross_validation_folds: 0,
  primary_metric: 'f1',
  status,
  duration_ms: 0,
  created_at: new Date().toISOString(),
  metrics: [],
  artifacts: [],
});

const noop = () => {};

const renderPage = () =>
  render(
    <ProjectDetailPage
      projectId={1}
      onBack={noop}
      onNavigateDataset={noop}
      onNavigateNewExperiment={noop}
      onNavigateExperiment={noop}
      onNavigateCompare={noop}
    />,
  );

describe('ProjectDetailPage polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getProject).mockResolvedValue(project);
    vi.mocked(api.getProjectDatasets).mockResolvedValue([]);
    vi.mocked(api.getLineage).mockResolvedValue([]);
    vi.mocked(api.getEvolution).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('keeps refreshing while a run is queued and stops once it has finished', async () => {
    vi.mocked(api.getProjectExperiments)
      .mockResolvedValueOnce([experiment('queued')])
      .mockResolvedValue([experiment('completed')]);

    renderPage();
    await screen.findByText('Baseline: logistic regression');
    expect(api.getProjectExperiments).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(api.getProjectExperiments).toHaveBeenCalledTimes(2);

    // The run is now completed, so no further requests should be made.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(api.getProjectExperiments).toHaveBeenCalledTimes(2);
  });

  it('does not poll when every run has already finished', async () => {
    vi.mocked(api.getProjectExperiments).mockResolvedValue([experiment('completed')]);

    renderPage();
    await screen.findByText('Baseline: logistic regression');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(api.getProjectExperiments).toHaveBeenCalledTimes(1);
  });
});
