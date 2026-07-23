import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnforcementStates } from '../_components/enforcement-states';
import type { QueryGuardState } from '@haiwave/protocol';

const states: QueryGuardState[] = [
  { id: 's1', owner_participant_id: 'me', counterparty_participant_id: 'cp-1', kind: 'block', expires_at: null, triggering_event_id: 'ev1', created_at: '2026-07-22T00:00:00Z', restored_at: null, restored_by: null },
  { id: 's2', owner_participant_id: 'me', counterparty_participant_id: 'cp-2', kind: 'log', expires_at: null, triggering_event_id: null, created_at: '2026-07-22T00:00:00Z', restored_at: null, restored_by: null },
];

describe('EnforcementStates', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ...states[0], restored_at: '2026-07-22T01:00:00Z' }) } as Response);
  });
  afterEach(() => fetchSpy.mockRestore());

  it('shows Restore for blocks and Clear for log states', () => {
    render(<EnforcementStates initialStates={states} />);
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('Restore POSTs and removes the row', async () => {
    render(<EnforcementStates initialStates={states} />);
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/account/query-guard/states/s1/restore');
    await waitFor(() => expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument());
  });

  it('renders the empty state', () => {
    render(<EnforcementStates initialStates={[]} />);
    expect(screen.getByText(/no counterparties are currently restricted/i)).toBeInTheDocument();
  });
});
