import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ExportButtons } from '../ExportButtons';
import { api } from '../../services/api';
import * as download from '../../utils/download';

vi.mock('../../services/api', () => ({
  api: { downloadExport: vi.fn() },
}));

const items = [
  { label: 'Export JSON', path: '/experiments/7/export?format=json', filename: 'experiment-7.json' },
  { label: 'Export Report', path: '/experiments/7/export?format=md', filename: 'experiment-7-report.md' },
];

describe('ExportButtons', () => {
  beforeEach(() => {
    vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.mocked(api.downloadExport).mockReset();
  });

  it('downloads the requested export and saves it under the given filename', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' });
    vi.mocked(api.downloadExport).mockResolvedValue(blob);
    render(<ExportButtons items={items} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    await waitFor(() => expect(download.saveBlob).toHaveBeenCalledWith(blob, 'experiment-7.json'));
    expect(api.downloadExport).toHaveBeenCalledWith('/experiments/7/export?format=json');
  });

  it('shows the server error and does not save anything when the export fails', async () => {
    vi.mocked(api.downloadExport).mockRejectedValue(new Error('Experiment not found'));
    render(<ExportButtons items={items} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export Report' }));

    expect(await screen.findByText('Experiment not found')).toBeInTheDocument();
    expect(download.saveBlob).not.toHaveBeenCalled();
  });
});
