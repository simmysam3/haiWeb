import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RunNowButton } from '../run-now-button';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('<RunNowButton>', () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it('renders a teal Run now button', () => {
    render(
      <RunNowButton
        trigger={async () => ({ runId: 'r-1' })}
        runDetailRoute="/account/sonar/audit"
      />,
    );
    expect(screen.getByRole('button', { name: 'Run now' })).toBeInTheDocument();
  });

  it('calls trigger and navigates to runDetailRoute/<runId> on success', async () => {
    const trigger = vi.fn(async () => ({ runId: 'abc-123' }));
    render(
      <RunNowButton
        trigger={trigger}
        runDetailRoute="/account/sonar/audit"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/account/sonar/audit/abc-123');
  });

  it('surfaces the trigger error inline and stays clickable', async () => {
    const trigger = vi
      .fn()
      .mockRejectedValueOnce(new Error('Backend exploded'));
    render(
      <RunNowButton trigger={trigger} runDetailRoute="/account/sonar/audit" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Backend exploded',
    );
    expect(pushMock).not.toHaveBeenCalled();
    // Button is no longer busy → still clickable for a retry.
    expect(screen.getByRole('button', { name: 'Run now' })).not.toBeDisabled();
  });
});
