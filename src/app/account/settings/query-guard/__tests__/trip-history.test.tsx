import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripHistory } from '../_components/trip-history';
import type { QueryGuardEvent } from '@haiwave/protocol';

function event(overrides: Partial<QueryGuardEvent>): QueryGuardEvent {
  return {
    id: 'e0',
    owner_participant_id: 'me',
    counterparty_participant_id: 'cp-1',
    rule_id: 'r1',
    rule_type: 'sku_repeat',
    observed_value: 12,
    threshold_value: 10,
    window: 'day',
    origin: 'ad_hoc',
    modality: 'watcher',
    actions_taken: [{ type: 'alert', email: null }],
    alert_suppressed: false,
    created_at: '2026-07-21T23:00:00Z',
    ...overrides,
  };
}

const events: QueryGuardEvent[] = [
  event({ id: 'e1', counterparty_participant_id: 'cp-1', rule_type: 'sku_repeat', observed_value: 12 }),
  event({ id: 'e2', counterparty_participant_id: 'cp-2', rule_type: 'sku_breadth', observed_value: 33, alert_suppressed: true }),
  event({ id: 'e3', counterparty_participant_id: 'cp-1', rule_type: 'excess_volume', observed_value: 150, threshold_value: 100, window: null }),
];

describe('TripHistory', () => {
  it('renders one row per event with observed-vs-threshold formatting', () => {
    render(<TripHistory initialEvents={events} />);
    expect(screen.getByText('12 > 10 / day')).toBeInTheDocument();
    expect(screen.getByText('33 > 10 / day')).toBeInTheDocument();
    // excess_volume has no window — percentage form
    expect(screen.getByText('150 > 100%')).toBeInTheDocument();
  });

  it('filters by rule type, showing only matching trips', () => {
    render(<TripHistory initialEvents={events} />);
    fireEvent.change(screen.getByLabelText(/rule type/i), { target: { value: 'sku_breadth' } });
    expect(screen.getByText('33 > 10 / day')).toBeInTheDocument();
    expect(screen.queryByText('12 > 10 / day')).not.toBeInTheDocument();
    expect(screen.queryByText('150 > 100%')).not.toBeInTheDocument();
  });

  it('filters by counterparty, showing only that counterparty\'s trips', () => {
    render(<TripHistory initialEvents={events} />);
    fireEvent.change(screen.getByLabelText(/counterparty/i), { target: { value: 'cp-2' } });
    expect(screen.getByText('33 > 10 / day')).toBeInTheDocument();
    expect(screen.queryByText('12 > 10 / day')).not.toBeInTheDocument();
  });

  it('marks only alert_suppressed trips with the "alert muted" pill (cooldown contract)', () => {
    render(<TripHistory initialEvents={events} />);
    // e2 is the one suppressed trip: it stays visible here, tagged muted.
    expect(screen.getAllByText('alert muted')).toHaveLength(1);
  });

  it('renders the empty message when no trips are recorded', () => {
    render(<TripHistory initialEvents={[]} />);
    expect(screen.getByText(/no guard trips recorded/i)).toBeInTheDocument();
  });
});
