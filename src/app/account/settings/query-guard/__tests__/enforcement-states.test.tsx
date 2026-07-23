import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { EnforcementStates } from '../_components/enforcement-states';
import type { QueryGuardEvent, QueryGuardState } from '@haiwave/protocol';

const states: QueryGuardState[] = [
  { id: 's1', owner_participant_id: 'me', counterparty_participant_id: 'cp-1', kind: 'block', expires_at: null, triggering_event_id: 'ev1', created_at: '2026-07-22T00:00:00Z', restored_at: null, restored_by: null },
  { id: 's2', owner_participant_id: 'me', counterparty_participant_id: 'cp-2', kind: 'log', expires_at: null, triggering_event_id: null, created_at: '2026-07-22T00:00:00Z', restored_at: null, restored_by: null },
];

const pauseState: QueryGuardState = {
  id: 's3',
  owner_participant_id: 'me',
  counterparty_participant_id: 'cp-3',
  kind: 'pause',
  expires_at: '2026-07-23T12:00:00Z',
  triggering_event_id: 'ev9',
  created_at: '2026-07-22T00:00:00Z',
  restored_at: null,
  restored_by: null,
};

function event(overrides: Partial<QueryGuardEvent>): QueryGuardEvent {
  return {
    id: 'ev0',
    owner_participant_id: 'me',
    counterparty_participant_id: 'cp-1',
    rule_id: 'r1',
    rule_type: 'sku_repeat',
    observed_value: 12,
    threshold_value: 10,
    window: 'day',
    origin: 'ad_hoc',
    modality: 'watcher',
    actions_taken: [{ type: 'block' }],
    alert_suppressed: false,
    created_at: '2026-07-21T23:00:00Z',
    ...overrides,
  };
}

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

  it('offers no row action for pause states (they lapse via expires_at; haiCore cannot clear them)', () => {
    render(<EnforcementStates initialStates={[pauseState]} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
    // The pause row still renders its expiry so the operator can see when it lifts.
    expect(
      screen.getByText(new Date(pauseState.expires_at as string).toLocaleString()),
    ).toBeInTheDocument();
  });

  it('Restore POSTs and removes the row', async () => {
    render(<EnforcementStates initialStates={states} />);
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/account/query-guard/states/s1/restore');
    await waitFor(() => expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument());
  });

  it('Clear on a log state POSTs to the clear endpoint and removes the row', async () => {
    render(<EnforcementStates initialStates={states} />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/account/query-guard/states/s2/clear');
    await waitFor(() => expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument());
  });

  it('renders the empty state', () => {
    render(<EnforcementStates initialStates={[]} />);
    expect(screen.getByText(/no counterparties are currently restricted/i)).toBeInTheDocument();
  });

  describe('row expansion (triggering trip)', () => {
    it('fetches the counterparty events and shows the event named by triggering_event_id, not the newest', async () => {
      // Newest event first (haiCore orders created_at DESC): a later alert-only
      // trip must NOT be presented as the block's triggering trip.
      const newer = event({ id: 'ev2', rule_type: 'ad_hoc_cap', created_at: '2026-07-22T02:00:00Z', actions_taken: [{ type: 'alert', email: null }] });
      const triggering = event({ id: 'ev1', rule_type: 'sku_breadth' });
      fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ events: [newer, triggering] }) } as Response);

      render(<EnforcementStates initialStates={[states[0]]} />);
      fireEvent.click(screen.getByRole('button', { name: /show triggering trip for cp-1/i }));

      await waitFor(() => expect(screen.getByText(/tripped/i)).toBeInTheDocument());
      const url = String(fetchSpy.mock.calls[0][0]);
      expect(url).toContain('/api/account/query-guard/events');
      expect(url).toContain('counterparty=cp-1');

      const detailRow = screen.getByText(/tripped/i).closest('td') as HTMLElement;
      expect(within(detailRow).getByText('sku_breadth')).toBeInTheDocument();
      expect(within(detailRow).queryByText('ad_hoc_cap')).not.toBeInTheDocument();
      // The "Triggering rule" column pill (title-cased by <Pill>) reflects the
      // triggering event too — not the newer trip.
      expect(screen.getByText('Sku breadth')).toBeInTheDocument();
      expect(screen.queryByText('Ad hoc cap')).not.toBeInTheDocument();
    });

    it('shows "no trip recorded" without fetching when triggering_event_id is null', async () => {
      render(<EnforcementStates initialStates={[states[1]]} />);
      fireEvent.click(screen.getByRole('button', { name: /show triggering trip for cp-2/i }));
      await waitFor(() =>
        expect(screen.getByText(/no trip recorded/i)).toBeInTheDocument(),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('shows "no trip recorded" when the triggering event is not in the fetched window', async () => {
      fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ events: [event({ id: 'ev-other' })] }) } as Response);
      render(<EnforcementStates initialStates={[states[0]]} />);
      fireEvent.click(screen.getByRole('button', { name: /show triggering trip for cp-1/i }));
      await waitFor(() =>
        expect(screen.getByText(/no trip recorded/i)).toBeInTheDocument(),
      );
    });
  });
});
