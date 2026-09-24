import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentDiffView } from '../ExperimentDiffView';
import { ExperimentDiffResponse } from '../../types';

const baseDiff: ExperimentDiffResponse = {
  experiment_a: { id: 1, name: 'Baseline Logistic Regression', model_type: 'logistic_regression' },
  experiment_b: { id: 2, name: 'Random Forest Upgrade', model_type: 'random_forest' },
  diffs: [
    {
      category: 'Model',
      property: 'Model Architecture',
      previous: 'logistic_regression',
      current: 'random_forest',
      changed: true,
      impact_note: 'Algorithm class changed',
    },
    {
      category: 'Preprocessing',
      property: 'Scaler',
      previous: 'standard',
      current: 'standard',
      changed: false,
      impact_note: 'Unchanged',
    },
  ],
  metrics_diff: [
    { metric: 'f1', previous: 0.75, current: 0.82, delta: 0.07, pct_change: 9.33, status: 'improved' },
    { metric: 'accuracy', previous: 0.8, current: 0.7, delta: -0.1, pct_change: -12.5, status: 'declined' },
  ],
};

describe('ExperimentDiffView', () => {
  it('renders both experiment identities and their model architectures', () => {
    render(<ExperimentDiffView diffData={baseDiff} />);

    expect(screen.getByText(/Baseline Logistic Regression/)).toBeInTheDocument();
    expect(screen.getByText(/Random Forest Upgrade/)).toBeInTheDocument();
  });

  it('renders every metric delta with its previous and current values', () => {
    render(<ExperimentDiffView diffData={baseDiff} />);

    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText('ACCURACY')).toBeInTheDocument();
    expect(screen.getByText('0.7500')).toBeInTheDocument();
    expect(screen.getByText('0.8200')).toBeInTheDocument();
  });

  it('marks a changed configuration property as MODIFIED and an unchanged one as UNCHANGED', () => {
    render(<ExperimentDiffView diffData={baseDiff} />);

    expect(screen.getByText('MODIFIED')).toBeInTheDocument();
    expect(screen.getByText('UNCHANGED')).toBeInTheDocument();
  });

  it('reports the correct count of modifications detected', () => {
    render(<ExperimentDiffView diffData={baseDiff} />);
    // Exactly one of the two diff rows above is `changed: true`.
    expect(screen.getByText('1 modifications detected')).toBeInTheDocument();
  });

  it('does not crash when metrics_diff contains a metric missing from one side', () => {
    const partialDiff: ExperimentDiffResponse = {
      ...baseDiff,
      metrics_diff: [
        { metric: 'roc_auc', previous: undefined as any, current: 0.91, delta: undefined as any, pct_change: undefined as any, status: 'neutral' },
      ],
    };
    render(<ExperimentDiffView diffData={partialDiff} />);
    expect(screen.getByText('ROC_AUC')).toBeInTheDocument();
  });
});
