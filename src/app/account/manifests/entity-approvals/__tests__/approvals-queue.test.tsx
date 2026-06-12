import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalsQueue } from '../approvals-queue';
import type { EntityApprovalQueueRow } from '../approvals-queue';

const useApi = vi.fn();
vi.mock('@/lib/use-api', () => ({
  useApi: (opts: unknown) => useApi(opts),
}));

const PENDING: EntityApprovalQueueRow = {
  request_id: 'r1',
  counterparty: { id: 'c1', name: 'Acme Brass' },
  submitted_at: '2026-06-01T12:00:00Z',
  gap_count: 3,
  status: 'pending',
  last_decision: null,
};

const APPROVED: EntityApprovalQueueRow = {
  request_id: 'r2',
  counterparty: { id: 'c2', name: 'Beta Manufacturing' },
  submitted_at: '2026-05-20T12:00:00Z',
  gap_count: 0,
  status: 'approved',
  last_decision: {
    decision: 'approved',
    tier: 'trading_pair',
    decided_by: 'jerry@apex.test',
    decided_at: '2026-05-22T09:00:00Z',
  },
};

// Mirrors the real BFF passthrough of haiCore GET /entity-approvals:
// `{ rows: [...] }`, NOT a bare array.
function mockQueue(rows: EntityApprovalQueueRow[], extra: Partial<{ loading: boolean; error: string | null }> = {}) {
  useApi.mockReturnValue({
    data: { rows },
    loading: extra.loading ?? false,
    error: extra.error ?? null,
    refetch: vi.fn(),
  });
}

describe('ApprovalsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue([PENDING]);
  });

  it('renders a pending row: name, submitted date, gap badge, status pill', () => {
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText('Acme Brass')).toBeInTheDocument();
    expect(screen.getByText('3 gaps')).toBeInTheDocument();
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
    // status pill (the Pill testid scopes past the "Pending" filter chip)
    expect(screen.getByTestId('pill')).toHaveTextContent('Pending');
  });

  it('renders "No gaps" when gap_count is 0', () => {
    mockQueue([APPROVED]);
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText('No gaps')).toBeInTheDocument();
  });

  it('shows approver + decided date when last_decision is present', () => {
    mockQueue([APPROVED]);
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText(/Approved by jerry@apex.test/)).toBeInTheDocument();
    // status pill reflects the approved state
    expect(screen.getByTestId('pill')).toHaveTextContent('Approved');
  });

  it('defaults to the pending filter and requests status=pending sort=date_desc', () => {
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    const opts = useApi.mock.calls[0][0] as { url: string };
    expect(opts.url).toContain('status=pending');
    expect(opts.url).toContain('sort=date_desc');
  });

  it('clicking the Approved filter chip refetches with status=approved', () => {
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    const lastUrl = (useApi.mock.calls.at(-1)![0] as { url: string }).url;
    expect(lastUrl).toContain('status=approved');
  });

  it('clicking the All filter chip refetches with status=all', () => {
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const lastUrl = (useApi.mock.calls.at(-1)![0] as { url: string }).url;
    expect(lastUrl).toContain('status=all');
  });

  it('debounces the search input into the query (300ms)', async () => {
    vi.useFakeTimers();
    try {
      render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
      const input = screen.getByPlaceholderText(/search/i);
      fireEvent.change(input, { target: { value: 'acme' } });
      // Not yet applied
      expect((useApi.mock.calls.at(-1)![0] as { url: string }).url).not.toContain('search=acme');
      vi.advanceTimersByTime(300);
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => {
      expect((useApi.mock.calls.at(-1)![0] as { url: string }).url).toContain('search=acme');
    });
  });

  it('toggling the sort flips date_desc to date_asc', () => {
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sort/i }));
    const lastUrl = (useApi.mock.calls.at(-1)![0] as { url: string }).url;
    expect(lastUrl).toContain('sort=date_asc');
  });

  it('clicking the row chevron invokes onReview with the row', () => {
    const onReview = vi.fn();
    render(<ApprovalsQueue onReview={onReview} onProactive={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /review acme brass/i }));
    expect(onReview).toHaveBeenCalledWith(PENDING);
  });

  it('clicking "Approve a company" invokes onProactive', () => {
    const onProactive = vi.fn();
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={onProactive} />);
    fireEvent.click(screen.getByRole('button', { name: /approve a company/i }));
    expect(onProactive).toHaveBeenCalled();
  });

  it('renders the empty state when there are no rows', () => {
    mockQueue([]);
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText(/no pending submissions/i)).toBeInTheDocument();
  });

  it('renders a loading state', () => {
    mockQueue([], { loading: true });
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders an error state', () => {
    mockQueue([], { error: '500' });
    render(<ApprovalsQueue onReview={vi.fn()} onProactive={vi.fn()} />);
    expect(screen.getByText(/couldn.t load|failed|error/i)).toBeInTheDocument();
  });
});
