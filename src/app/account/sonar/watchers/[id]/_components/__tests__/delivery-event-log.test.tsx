import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeliveryEventLog } from '../delivery-event-log';

describe('<DeliveryEventLog>', () => {
  it('renders chronological events (most recent first) when direct', () => {
    render(
      <DeliveryEventLog
        synthesisMode="direct"
        payload={{
          events: [
            { event_type: 'delivered', occurred_at: '2026-05-26T12:00:00Z', shipment_id: 'SHP-1', detail: null },
            { event_type: 'in_transit', occurred_at: '2026-05-25T08:00:00Z', shipment_id: 'SHP-1', detail: null },
          ],
        }}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('delivered');
    expect(items[1]).toHaveTextContent('in_transit');
  });

  it('shows the "Show N more" expander when more than 3 events', () => {
    render(
      <DeliveryEventLog
        synthesisMode="direct"
        payload={{
          events: Array.from({ length: 5 }, (_, i) => ({
            event_type: 'in_transit' as const,
            occurred_at: `2026-05-2${i + 1}T08:00:00Z`,
            shipment_id: `SHP-${i}`,
            detail: null,
          })),
        }}
      />,
    );
    expect(screen.getByRole('button', { name: /Show 2 more/i })).toBeInTheDocument();
  });

  it('renders absent treatment when redacted_gap', () => {
    render(<DeliveryEventLog synthesisMode="redacted_gap" payload={null} />);
    expect(screen.getByText(/order-status feed not shared/i)).toBeInTheDocument();
  });
});
