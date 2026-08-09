import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrdersDashboard } from '../orders-dashboard';

const useApi = vi.fn();
vi.mock('@/lib/use-api', () => ({
  useApi: (opts: unknown) => useApi(opts),
}));

function mockOrders(rows: unknown[]) {
  useApi.mockReturnValue({
    data: { sell_side: rows },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

describe('OrdersDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrders([]);
  });

  // 'failed' was only ever written by haiCore's retired ERP push path
  // (removed in haiCore #291) — the filter would render a permanently
  // empty tab.
  it('does not render a Failed status filter', () => {
    render(<OrdersDashboard />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Failed' })).not.toBeInTheDocument();
  });

  // haiCore #291 dropped the erp_* columns; the API no longer returns
  // them. A stale or cached payload must not resurrect the line either.
  it('does not render an ERP reference line even when the payload still carries erp_order_reference', () => {
    mockOrders([
      {
        id: 'o1',
        order_id: 'aaaabbbb-0000-4000-8000-000000000001',
        invoice_id: 'ccccdddd-0000-4000-8000-000000000002',
        vendor_participant_id: 'v1',
        buyer_participant_id: 'b1',
        status: 'processed',
        erp_platform: 'epicor_kinetic',
        erp_order_reference: 'MOCK-SO-12345',
        po_number: 'PO-77',
        order_total: 120.5,
        currency: 'USD',
        line_items_summary: '2 items',
        created_at: '2026-08-01T12:00:00Z',
        updated_at: '2026-08-01T12:00:00Z',
        processed_at: '2026-08-01T13:00:00Z',
        completed_at: null,
      },
    ]);
    render(<OrdersDashboard />);
    expect(screen.getByText(/Order aaaabbbb/)).toBeInTheDocument();
    expect(screen.queryByText(/ERP Ref/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MOCK-SO-12345/)).not.toBeInTheDocument();
  });
});
