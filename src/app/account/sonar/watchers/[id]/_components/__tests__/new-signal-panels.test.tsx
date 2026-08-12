import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderPromiseSchedulePanel } from '../order-promise-schedule-panel';
import { OrderFulfillmentHistoryPanel } from '../order-fulfillment-history-panel';
import { SoftQuotedLeadTimePanel } from '../soft-quoted-lead-time-panel';

describe('OrderPromiseSchedulePanel', () => {
  it('renders promised → current per line with the slip delta', () => {
    render(
      <OrderPromiseSchedulePanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          order_id: '11111111-1111-1111-1111-111111111111',
          vendor_order_reference: 'SO-1042',
          observed_at: '2026-08-01T00:00:00Z',
          lines: [
            {
              line_number: 1,
              promised: [{ date: '2026-08-10', quantity: 100 }],
              current: [
                { date: '2026-08-10', quantity: 40 },
                { date: '2026-08-17', quantity: 60 },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/SO-1042/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-10 → 2026-08-17/)).toBeInTheDocument();
    expect(screen.getByText(/7d later/)).toBeInTheDocument();
  });
  it('re-split without completion movement reads "on promise"', () => {
    render(
      <OrderPromiseSchedulePanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          order_id: '11111111-1111-1111-1111-111111111111',
          observed_at: '2026-08-01T00:00:00Z',
          lines: [{ line_number: 2, promised: [{ date: '2026-08-10', quantity: 10 }], current: [{ date: '2026-08-10', quantity: 10 }] }],
        }}
      />,
    );
    expect(screen.getByText(/on promise/)).toBeInTheDocument();
  });
  it('gap renders honest not-shared copy', () => {
    render(<OrderPromiseSchedulePanel synthesisMode="redacted_gap" payload={null} />);
    expect(screen.getByText(/Order-promise signal not shared/)).toBeInTheDocument();
  });
});

describe('OrderFulfillmentHistoryPanel', () => {
  it('sample_count 0 reads as no observations, never as 0 days', () => {
    render(
      <OrderFulfillmentHistoryPanel
        synthesisMode="direct"
        payload={{ kind: 'direct', active_orders: [], recent_fulfillments: [], calibrated: { days: 0, sample_count: 0 } }}
      />,
    );
    expect(screen.getByText(/no observations yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0d/)).toBeNull();
  });
  it('renders calibrated days with observation count and recent quoted→actual rows', () => {
    render(
      <OrderFulfillmentHistoryPanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          active_orders: [{ po_number: 'PO-9', quantity: 50, quoted_ship_date: '2026-08-20' }],
          recent_fulfillments: [{ po_number: 'PO-7', quantity: 25, quoted_ship_date: '2026-07-01', actual_ship_date: '2026-07-03' }],
          calibrated: { days: 18, sample_count: 12 },
        }}
      />,
    );
    expect(screen.getByText(/18d/)).toBeInTheDocument();
    expect(screen.getByText(/12 obs/)).toBeInTheDocument();
    expect(screen.getByText(/PO-7/)).toBeInTheDocument();
    expect(screen.getByText(/1 active order/)).toBeInTheDocument();
  });
});

describe('SoftQuotedLeadTimePanel', () => {
  it('renders days for the ask quantity', () => {
    render(
      <SoftQuotedLeadTimePanel
        synthesisMode="direct"
        payload={{ kind: 'direct', days: 9, availability: 'available', ask_quantity: 500, resolved_via: 'phantom_demand_bom', observed_at: '2026-08-01T00:00:00Z' }}
      />,
    );
    expect(screen.getByText(/9d/)).toBeInTheDocument();
    expect(screen.getByText(/500 units/)).toBeInTheDocument();
  });
  it('unavailable is stated, not zeroed', () => {
    render(
      <SoftQuotedLeadTimePanel
        synthesisMode="direct"
        payload={{ kind: 'direct', days: null, availability: 'unavailable', ask_quantity: 500, resolved_via: 'phantom_demand_bom', observed_at: '2026-08-01T00:00:00Z' }}
      />,
    );
    expect(screen.getByText(/unavailable for 500 units/i)).toBeInTheDocument();
  });
});
