import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DatasetIntelligencePage } from '../DatasetIntelligencePage';
import { Dataset, DatasetHealthReport } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getDataset: vi.fn(),
    getDatasetPreview: vi.fn(),
    getDatasetHealth: vi.fn(),
    uploadDataset: vi.fn(),
  },
}));

import { api } from '../../services/api';

const dataset: Dataset = {
  id: 1,
  project_id: 1,
  filename: 'classification_titanic.csv',
  row_count: 90,
  col_count: 10,
  sha256_hash: 'f'.repeat(64),
  target_column: 'Survived',
  summary_stats: {},
  created_at: new Date().toISOString(),
};

const health: DatasetHealthReport = {
  row_count: 90,
  col_count: 10,
  duplicate_rows: 0,
  total_missing_cells: 22,
  missing_pct: 2.4,
  health_score: 82,
  health_status: 'Good',
  columns: [
    {
      name: 'Age',
      dtype: 'float64',
      inferred_type: 'numeric',
      missing_count: 22,
      missing_pct: 24.4,
      unique_count: 60,
      is_constant: false,
      is_potential_target: false,
      is_potential_leakage: false,
      leakage_reasons: [],
      stats: { min: 0.4, max: 74, mean: 29.5, std: 14.2, median: 28, q25: 20, q75: 38 },
      outlier_count: 3,
    },
    {
      name: 'PassengerId',
      dtype: 'int64',
      inferred_type: 'id',
      missing_count: 0,
      missing_pct: 0,
      unique_count: 90,
      is_constant: false,
      is_potential_target: false,
      is_potential_leakage: true,
      leakage_reasons: ['High-cardinality identifier; may cause spurious memorization if used as feature.'],
      stats: {},
      outlier_count: 0,
    },
  ],
  potential_targets: ['Survived'],
  leakage_warnings: [
    { column: 'PassengerId', reasons: ['High-cardinality identifier; may cause spurious memorization if used as feature.'], risk: 'Medium' },
  ],
  correlation_matrix: {},
  class_balance: { '0': 55, '1': 35 },
  summary_notes: ['Moderate missing data: 2.4% missing cells.'],
};

const preview = { columns: ['Age', 'PassengerId'], total_rows: 90, data: [{ Age: 22, PassengerId: 1 }] };

const noop = () => {};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DatasetIntelligencePage', () => {
  it('renders the health score, row/column counts, and filename', async () => {
    (api.getDataset as any).mockResolvedValue(dataset);
    (api.getDatasetPreview as any).mockResolvedValue(preview);
    (api.getDatasetHealth as any).mockResolvedValue(health);

    render(<DatasetIntelligencePage datasetId={1} onBack={noop} />);

    // The filename legitimately appears twice (breadcrumb + card header).
    const filenameMatches = await screen.findAllByText('classification_titanic.csv');
    expect(filenameMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    // row_count (90) legitimately also appears elsewhere (e.g. a column's
    // unique-value count can coincidentally equal it), so scope this check
    // to the ROWS stat card specifically rather than a bare text match.
    expect(screen.getByText('ROWS').nextSibling).toHaveTextContent('90');
  });

  it('surfaces a data leakage warning for a flagged column', async () => {
    (api.getDataset as any).mockResolvedValue(dataset);
    (api.getDatasetPreview as any).mockResolvedValue(preview);
    (api.getDatasetHealth as any).mockResolvedValue(health);

    render(<DatasetIntelligencePage datasetId={1} onBack={noop} />);

    expect(await screen.findByText(/Column: PassengerId/)).toBeInTheDocument();
    expect(screen.getByText(/High-cardinality identifier/)).toBeInTheDocument();
  });

  it('shows a positive empty state when there are no leakage warnings', async () => {
    const cleanHealth: DatasetHealthReport = { ...health, leakage_warnings: [] };
    (api.getDataset as any).mockResolvedValue(dataset);
    (api.getDatasetPreview as any).mockResolvedValue(preview);
    (api.getDatasetHealth as any).mockResolvedValue(cleanHealth);

    render(<DatasetIntelligencePage datasetId={1} onBack={noop} />);

    expect(await screen.findByText(/No obvious data leakage patterns/)).toBeInTheDocument();
  });

  it('renders the class balance breakdown when present', async () => {
    (api.getDataset as any).mockResolvedValue(dataset);
    (api.getDatasetPreview as any).mockResolvedValue(preview);
    (api.getDatasetHealth as any).mockResolvedValue(health);

    render(<DatasetIntelligencePage datasetId={1} onBack={noop} />);

    expect(await screen.findByText(/Target Class Distribution/)).toBeInTheDocument();
  });
});
