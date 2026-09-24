import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExperimentDesignerPage } from '../ExperimentDesignerPage';
import { Project, Dataset, Experiment } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getProject: vi.fn(),
    getProjectDatasets: vi.fn(),
    getProjectExperiments: vi.fn(),
    createExperiment: vi.fn(),
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
  experiment_count: 0,
};

const dataset: Dataset = {
  id: 1,
  project_id: 1,
  filename: 'titanic.csv',
  row_count: 90,
  col_count: 4,
  sha256_hash: 'a'.repeat(64),
  target_column: 'Survived',
  summary_stats: {
    potential_targets: ['Survived'],
    columns: [
      { name: 'Pclass' }, { name: 'Sex' }, { name: 'Age' }, { name: 'Survived' },
    ],
  },
  created_at: new Date().toISOString(),
};

const createdExperiment: Experiment = {
  id: 42,
  project_id: 1,
  dataset_id: 1,
  name: 'Random Forest Iteration #1',
  model_type: 'random_forest',
  hyperparameters: { n_estimators: 100, max_depth: 10 },
  preprocessing_config: { imputer_strategy: 'mean', scaler: 'standard', encoder: 'onehot' },
  feature_selection: ['Pclass', 'Sex', 'Age'],
  target_column: 'Survived',
  random_seed: 42,
  test_size: 0.2,
  cross_validation_folds: 0,
  primary_metric: 'f1',
  status: 'queued',
  duration_ms: 0,
  created_at: new Date().toISOString(),
  metrics: [],
  artifacts: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExperimentDesignerPage (critical form: run an experiment)', () => {
  it('submits the configured model type and calls onExperimentCreated with the new id', async () => {
    (api.getProject as any).mockResolvedValue(project);
    (api.getProjectDatasets as any).mockResolvedValue([dataset]);
    (api.getProjectExperiments as any).mockResolvedValue([]);
    (api.createExperiment as any).mockResolvedValue(createdExperiment);

    const onExperimentCreated = vi.fn();
    const user = userEvent.setup();

    render(
      <ExperimentDesignerPage
        projectId={1}
        onBack={() => {}}
        onExperimentCreated={onExperimentCreated}
      />
    );

    const modelSelect = await screen.findByLabelText(/Candidate Model/i) as HTMLSelectElement;
    expect(modelSelect.value).toBe('logistic_regression'); // classification default

    await user.selectOptions(modelSelect, 'random_forest');
    expect(modelSelect.value).toBe('random_forest');

    const submitButton = screen.getByRole('button', { name: /Run Experiment/i });
    await user.click(submitButton);

    await waitFor(() => expect(api.createExperiment).toHaveBeenCalledTimes(1));

    const payload = (api.createExperiment as any).mock.calls[0][0];
    expect(payload.project_id).toBe(1);
    expect(payload.dataset_id).toBe(1);
    expect(payload.model_type).toBe('random_forest');
    expect(payload.target_column).toBe('Survived');
    expect(payload.feature_selection).toEqual(expect.arrayContaining(['Pclass', 'Sex', 'Age']));

    await waitFor(() => expect(onExperimentCreated).toHaveBeenCalledWith(42));
  });

  it('requires at least one feature to remain selected', async () => {
    (api.getProject as any).mockResolvedValue(project);
    (api.getProjectDatasets as any).mockResolvedValue([dataset]);
    (api.getProjectExperiments as any).mockResolvedValue([]);

    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ExperimentDesignerPage projectId={1} onBack={() => {}} onExperimentCreated={() => {}} />);

    await screen.findByLabelText(/Candidate Model/i);

    // Uncheck all but one feature, then try to uncheck the last one.
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    for (const cb of checkboxes.slice(1)) {
      await user.click(cb);
    }
    await user.click(checkboxes[0]);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('at least one predictive feature'));
    alertSpy.mockRestore();
  });
});
