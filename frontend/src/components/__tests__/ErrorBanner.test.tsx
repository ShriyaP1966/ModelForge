import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBanner } from '../ErrorBanner';

describe('ErrorBanner', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<ErrorBanner message={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message when present', () => {
    render(<ErrorBanner message="Something went wrong." onDismiss={() => {}} />);
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('calls onDismiss when the close button is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner message="Failed." onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
