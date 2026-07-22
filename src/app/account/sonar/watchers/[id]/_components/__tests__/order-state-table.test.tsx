import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrderFulfillmentHistoryPayload } from '@haiwave/protocol';
import { OrderStateTable } from '../order-state-table';

describe('<OrderStateTable>', () => {
  it('renders active orders and recent fulfillments with ship dates and a +2d delta chip', () => {
    const payload: OrderFulfillmentHistoryPayload = {
      kind: 'direct',
      active_orders: [
        { po_number: 'AO-100', quantity: 120, quoted_ship_date: '2026-08-01T00:00:00Z' },
      ],
      recent_fulfillments: [
        // shipped 2 days after the quoted date → +2d
        {
          po_number: 'PO-501',
          quantity: 50,
          quoted_ship_date: '2026-06-01T00:00:00Z',
          actual_ship_date: '2026-06-03T00:00:00Z',
        },
        // shipped on the quoted date → on time
        {
          po_number: 'PO-502',
          quantity: 60,
          quoted_ship_date: '2026-06-10T00:00:00Z',
          actual_ship_date: '2026-06-10T00:00:00Z',
        },
      ],
      calibrated: { days: 2, sample_count: 12 },
    };

    render(<OrderStateTable payload={payload} />);

    // PO numbers from both sub-tables
    expect(screen.getByText('AO-100')).toBeInTheDocument();
    expect(screen.getByText('PO-501')).toBeInTheDocument();
    expect(screen.getByText('PO-502')).toBeInTheDocument();

    // ship dates (active-order quoted ship + the late fulfillment's actual ship)
    expect(screen.getByText(/Aug 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 3, 2026/)).toBeInTheDocument();

    // delta chips
    expect(screen.getByText('+2d')).toBeInTheDocument();
    expect(screen.getByText(/on time/i)).toBeInTheDocument();
  });

  it('renders only the most recent 5 of 7 fulfillments', () => {
    const recent_fulfillments = Array.from({ length: 7 }, (_, i) => ({
      po_number: `PO-${String(i + 1).padStart(3, '0')}`,
      quantity: 10,
      quoted_ship_date: '2026-06-01T00:00:00Z',
      actual_ship_date: '2026-06-01T00:00:00Z',
    }));
    const payload: OrderFulfillmentHistoryPayload = {
      kind: 'direct',
      active_orders: [],
      recent_fulfillments,
      calibrated: { days: 0, sample_count: 7 },
    };

    render(<OrderStateTable payload={payload} />);

    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByText(`PO-${String(i).padStart(3, '0')}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('PO-006')).not.toBeInTheDocument();
    expect(screen.queryByText('PO-007')).not.toBeInTheDocument();
  });
});
