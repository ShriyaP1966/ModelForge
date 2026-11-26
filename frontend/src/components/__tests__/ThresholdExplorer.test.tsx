import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ThresholdExplorer } from '../ThresholdExplorer';
import { ThresholdAnalysis } from '../../utils/threshold';

afterEach(cleanup);

const analysis: ThresholdAnalysis = {
  thresholds: [0, 0.25, 0.5, 0.75, 1],
  tp: [3, 3, 2, 1, 0],
  fp: [3, 2, 1, 0, 0],
  tn: [0, 1, 2, 3, 3],
  fn: [0, 0, 1, 2, 3],
  positive_label: 'yes',
  negative_label: 'no',
};

const rocData = { fpr: [0, 0.33, 1], tpr: [0, 0.67, 1], auc: 0.8 };

describe('ThresholdExplorer', () => {
  it('starts at the 0.50 threshold with metrics for that cutoff', () => {
    render(<ThresholdExplorer analysis={analysis} rocData={rocData} />);

    expect(screen.getByTestId('threshold-value')).toHaveTextContent('0.50');
    expect(screen.getByText('Precision').nextSibling).toHaveTextContent('66.7%');
  });

  it('updates the metrics when the slider moves', () => {
    render(<ThresholdExplorer analysis={analysis} rocData={rocData} />);

    fireEvent.change(screen.getByLabelText(/decision threshold/i), { target: { value: '3' } });

    expect(screen.getByTestId('threshold-value')).toHaveTextContent('0.75');
    // threshold 0.75: tp=1 fp=0 -> precision 100%, recall 1/3
    expect(screen.getByText('Precision').nextSibling).toHaveTextContent('100.0%');
    expect(screen.getByText('Recall').nextSibling).toHaveTextContent('33.3%');
  });

  it('jumps to the best-F1 threshold and back to the default', () => {
    render(<ThresholdExplorer analysis={analysis} rocData={rocData} />);

    fireEvent.click(screen.getByRole('button', { name: /best f1/i }));
    expect(screen.getByTestId('threshold-value')).toHaveTextContent('0.25');

    fireEvent.click(screen.getByRole('button', { name: /reset to 0.50/i }));
    expect(screen.getByTestId('threshold-value')).toHaveTextContent('0.50');
  });

  it('marks the selected operating point on the curve', () => {
    render(<ThresholdExplorer analysis={analysis} rocData={rocData} />);

    expect(screen.getByTestId('operating-point')).toBeInTheDocument();
  });
});
