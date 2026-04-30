import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Type2Run } from '@haiwave/protocol';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

import { RunHistory } from '../run-history';

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRun: Type2Run = {
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
};

describe('RunHistory', () => {
  it('renders an empty-state message when no runs exist', () => {
    render(<RunHistory runs={[]} onCancel={() => {}} />);
    expect(screen.getByText(/No runs yet/i)).toBeInTheDocument();
  });

  it('renders a row per run with the status pill text', () => {
    const runs: Type2Run[] = [
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
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ cancelled: true }) });
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<RunHistory runs={[baseRun]} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/account/sonar/type2/runs/${baseRun.run_id}/cancel`,
        { method: 'POST' },
      );
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('does not show Cancel for non-running runs', () => {
    render(<RunHistory runs={[{ ...baseRun, status: 'complete' }]} onCancel={() => {}} />);
    expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
  });
});
