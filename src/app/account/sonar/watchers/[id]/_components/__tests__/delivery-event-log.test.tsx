import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeliveryEventLog } from '../delivery-event-log';

describe('<DeliveryEventLog>', () => {
  it('renders a single direct delivery event (protocol DeliveryEventSchema shape — no events[] wrapper)', () => {
    render(
      <DeliveryEventLog
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          event_type: 'delivered',
          occurred_at: '2026-05-26T12:00:00Z',
          shipment_id: 'SHIP-ARNO-1000',
          detail: 'vomero demo seed',
        }}
      />,
    );
    expect(screen.getByText('delivered')).toBeInTheDocument();
    expect(screen.getByText('SHIP-ARNO-1000')).toBeInTheDocument();
    expect(screen.getByText('vomero demo seed')).toBeInTheDocument();
  });

  it('renders the aggregated variant with its source handle', () => {
    render(
      <DeliveryEventLog
        synthesisMode="aggregated_derivative"
        payload={{
          kind: 'aggregated',
          event_type: 'in_transit',
          timestamp: '2026-05-25T08:00:00Z',
          source_handle: 'tier-2/handle-7',
        }}
      />,
    );
    expect(screen.getByText('in_transit')).toBeInTheDocument();
    expect(screen.getByText(/tier-2\/handle-7/)).toBeInTheDocument();
  });

  it('renders absent treatment when redacted_gap', () => {
    render(<DeliveryEventLog synthesisMode="redacted_gap" payload={null} />);
    expect(screen.getByText(/order-status feed not shared/i)).toBeInTheDocument();
  });
});
