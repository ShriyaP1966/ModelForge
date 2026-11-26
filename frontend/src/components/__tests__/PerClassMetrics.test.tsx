import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PerClassMetrics } from '../PerClassMetrics';

afterEach(cleanup);

describe('PerClassMetrics', () => {
  it('renders one row per class with its metrics', () => {
    render(
      <PerClassMetrics
        classes={[
          { label: 'cat', precision: 0.9, recall: 0.8, f1: 0.847, support: 10 },
          { label: 'dog', precision: 0.5, recall: 1, f1: 0.667, support: 4 },
        ]}
      />,
    );

    expect(screen.getByRole('rowheader', { name: 'cat' })).toBeInTheDocument();
    expect(screen.getByText('0.900')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'dog' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows an empty state when there are no classes', () => {
    render(<PerClassMetrics classes={[]} />);

    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });
});
