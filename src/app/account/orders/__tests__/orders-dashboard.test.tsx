import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const pendingOrder = {
  id: 'o-pending',
  order_id: 'eeeeffff-0000-4000-8000-000000000003',
  invoice_id: 'inv-1',
  vendor_participant_id: 'v1',
  buyer_participant_id: 'b1',
  status: 'pending',
  po_number: 'PO-1',
  order_total: 10,
  currency: 'USD',
  line_items_summary: '1 item',
  created_at: '2026-08-01T12:00:00Z',
  updated_at: '2026-08-01T12:00:00Z',
  processed_at: null,
  completed_at: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('OrdersDashboard — process/complete report the response (SEC-web-account-2-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('Process: a 403 shows the permission error and does not refetch', async () => {
    const refetch = vi.fn();
    useApi.mockReturnValue({ data: { sell_side: [pendingOrder] }, loading: false, error: null, refetch });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<OrdersDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /^process$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('Process: a 2xx re-reads the orders and shows no error', async () => {
    const refetch = vi.fn();
    useApi.mockReturnValue({ data: { sell_side: [pendingOrder] }, loading: false, error: null, refetch });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ id: 'o-pending', status: 'processed' }));
    render(<OrdersDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /^process$/i }));

    await vi.waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('OrdersDashboard — a failed read is never an empty order book (SEC-web-account-2-06 instance)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('a failed read shows a could-not-load notice with Retry, not "No sell-side orders"', () => {
    const refetch = vi.fn();
    useApi.mockReturnValue({ data: { sell_side: [] }, loading: false, error: '500', refetch });
    render(<OrdersDashboard />);

    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/No sell-side orders/i)).not.toBeInTheDocument();
  });
});
