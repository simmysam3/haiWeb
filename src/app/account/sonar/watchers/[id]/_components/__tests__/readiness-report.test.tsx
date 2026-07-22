import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadinessReport } from '../readiness-report';
import type { ReadinessSku } from '../../_lib/pivot-readiness';

const sku: ReadinessSku = {
  sku: 'SKU-COMPRESSOR-BLADE',
  product_name: 'Compressor Blade',
  ask: { sku: 'SKU-COMPRESSOR-BLADE', ask_quantity: 40, target_days: 42 },
  vendors: [
    {
      vendor_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      vendor_name: 'Precision Foundry',
      order_state: {
        kind: 'direct',
        active_orders: [
          { po_number: 'AO-900', quantity: 40, quoted_ship_date: '2026-08-01T00:00:00Z' },
        ],
        recent_fulfillments: [],
        calibrated: { days: 12, sample_count: 8 },
      },
      lead_time_rows: [
        {
          run_date: '2026-06-15T00:00:00Z',
          published: 20,
          calibrated: 12,
          soft_quoted: 34,
          soft_quoted_unavailable: false,
          capacity: 'moderate',
        },
      ],
    },
  ],
};

describe('<ReadinessReport>', () => {
  it('renders the SKU header with the ask quantity + rolling target window', () => {
    render(<ReadinessReport skus={[sku]} />);

    expect(screen.getByText('Compressor Blade')).toBeInTheDocument();
    expect(screen.getByText(/Ask:\s*40\s*.*within\s*42\s*calendar days/)).toBeInTheDocument();
  });

  it('renders each vendor with both the order-state and lead-time tables', () => {
    render(<ReadinessReport skus={[sku]} />);

    // vendor name
    expect(screen.getByText('Precision Foundry')).toBeInTheDocument();

    // <OrderStateTable> mounted (an active-order PO number)
    expect(screen.getByText('AO-900')).toBeInTheDocument();

    // <LeadTimeHistoryTable> mounted (its run-date column header)
    expect(screen.getByText('Run date')).toBeInTheDocument();
  });
});
