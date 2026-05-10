import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WatcherRun } from '@haiwave/protocol';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { RunHistory } from '../run-history';

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRun: WatcherRun = {
  run_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  initiator_participant_id: 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii',
  status: 'running',
  signal_types: ['lead_time_distribution'],
  counterparty_filter: null,
  cadence: 'on_demand',
  observation_class: 'continuous',
  triggered_at: '2026-04-29T10:00:00Z',
  completed_at: null,
  cancelled_at: null,
  transformation_chain: null,
  // v1.29 Phase 2
  depth_limit: 1,
};

describe('RunHistory', () => {
  it('renders an empty-state message when no runs exist', () => {
    render(<RunHistory runs={[]} onCancel={() => {}} />);
    expect(screen.getByText(/No runs yet/i)).toBeInTheDocument();
  });

  it('renders a row per run with the status pill text', () => {
    const runs: WatcherRun[] = [
      { ...baseRun, status: 'complete', completed_at: '2026-04-29T10:05:00Z' },
      { ...baseRun, run_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', status: 'failed' },
    ];
    const { container } = render(<RunHistory runs={runs} onCancel={() => {}} />);
    // Status pills carry capitalize + a status-specific class; use the
    // text content directly via container queries to disambiguate from
    // the "Completed" column header.
    const pills = container.querySelectorAll('span.capitalize');
    const labels = Array.from(pills).map((el) => el.textContent);
    expect(labels).toContain('complete');
    expect(labels).toContain('failed');
  });

  it('shows a Cancel button only for running runs and POSTs to the cancel route', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ cancelled: true }),
    });
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<RunHistory runs={[baseRun]} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/account/sonar/watcher/runs/${baseRun.run_id}/cancel`,
        { method: 'POST' },
      );
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('does not show Cancel for non-running runs', () => {
    render(<RunHistory runs={[{ ...baseRun, status: 'complete' }]} onCancel={() => {}} />);
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('shows a Cancelling… pill and disables the Cancel button after a successful click, until the row leaves running', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ cancelled: true }),
    });
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RunHistory runs={[baseRun]} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    // After fetch resolves: status pill flips to "Cancelling…" and the
    // Cancel button is disabled while we wait for the next poll.
    await waitFor(() => {
      expect(screen.getByText(/Cancelling…/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Simulate the next SWR poll surfacing the new status — the row is
    // no longer running, so the Cancelling… pill should clear and the
    // Cancel button should disappear.
    rerender(
      <RunHistory
        runs={[{ ...baseRun, status: 'cancelled', cancelled_at: '2026-04-29T10:01:00Z' }]}
        onCancel={onCancel}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText(/Cancelling…/)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it('renders a user-visible error and re-enables the Cancel button when cancel fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
      json: () => Promise.resolve({ error: 'boom' }),
    });
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<RunHistory runs={[baseRun]} onCancel={onCancel} />);

    const button = screen.getByRole('button', { name: /Cancel/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/boom/)).toBeInTheDocument();
    });
    // onCancel must NOT fire on non-OK — parent should not revalidate
    // SWR for a failed request.
    expect(onCancel).not.toHaveBeenCalled();
    // Button is re-enabled so the user can retry.
    expect(screen.getByRole('button', { name: /Cancel/i })).not.toBeDisabled();
    // Status pill is still "running" (no Cancelling… mid-state).
    expect(screen.queryByText(/Cancelling…/)).not.toBeInTheDocument();
  });
});
