import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsPanel } from '../notifications-panel';
import type { NotificationRow } from '../notifications-panel';

const useApi = vi.fn();
vi.mock('@/lib/use-api', () => ({
  useApi: (opts: unknown) => useApi(opts),
}));

function notif(over: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    class: 'entity_approval',
    payload: {},
    created_at: '2026-06-10T12:00:00Z',
    read_at: null,
    ...over,
  };
}

const APPROVED = notif({
  id: 'n1',
  class: 'entity_approval',
  payload: { counterparty_name: 'Acme Brass', decision: 'approved', tier_label: 'Trading Pair', decided_by: 'jerry@apex.test' },
  read_at: null,
});

const REVOKED = notif({
  id: 'n2',
  class: 'entity_approval',
  payload: {
    counterparty_name: 'Beta Manufacturing',
    decision: 'revoked',
    tier_label: 'Connection',
    decided_by: 'jerry@apex.test',
    outstanding_element_labels: ['General Liability Limits', 'ISO 9001'],
  },
  read_at: '2026-06-10T13:00:00Z',
});

// Mirrors the real BFF passthrough of haiCore GET /notifications:
// `{ notifications: [...] }`, NOT a bare array.
function mockNotifs(rows: NotificationRow[], extra: Partial<{ loading: boolean; error: string | null }> = {}) {
  useApi.mockReturnValue({
    data: { notifications: rows },
    loading: extra.loading ?? false,
    error: extra.error ?? null,
    refetch: vi.fn(),
  });
}

describe('NotificationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifs([APPROVED]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches all notifications', () => {
    render(<NotificationsPanel />);
    expect((useApi.mock.calls[0][0] as { url: string }).url).toBe('/api/account/notifications');
  });

  it('renders an entity_approval approval with counterparty, tier and approver', () => {
    render(<NotificationsPanel />);
    expect(screen.getByText(/Acme Brass/)).toBeInTheDocument();
    expect(screen.getByText(/Approved to Trading Pair/)).toBeInTheDocument();
    expect(screen.getByText(/jerry@apex.test/)).toBeInTheDocument();
  });

  it('renders a revoked notification with the outstanding labels line', () => {
    mockNotifs([REVOKED]);
    render(<NotificationsPanel />);
    expect(screen.getByText(/Revoked/)).toBeInTheDocument();
    expect(screen.getByText(/General Liability Limits, ISO 9001/)).toBeInTheDocument();
  });

  it('emphasizes unread notifications (data-unread true) and not read ones', () => {
    mockNotifs([APPROVED, REVOKED]);
    render(<NotificationsPanel />);
    expect(screen.getByTestId('notif-n1')).toHaveAttribute('data-unread', 'true');
    expect(screen.getByTestId('notif-n2')).toHaveAttribute('data-unread', 'false');
  });

  it('clicking an unread notification optimistically de-emphasizes it and POSTs read', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationsPanel />);
    const item = screen.getByTestId('notif-n1');
    expect(item).toHaveAttribute('data-unread', 'true');
    fireEvent.click(item);
    expect(screen.getByTestId('notif-n1')).toHaveAttribute('data-unread', 'false');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/account/notifications/n1/read', expect.objectContaining({ method: 'POST' })));
  });

  it('reverts the optimistic read when the POST fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationsPanel />);
    fireEvent.click(screen.getByTestId('notif-n1'));
    expect(screen.getByTestId('notif-n1')).toHaveAttribute('data-unread', 'false');
    await waitFor(() => expect(screen.getByTestId('notif-n1')).toHaveAttribute('data-unread', 'true'));
  });

  it('renders an unknown class as a generic fallback with the class name and date', () => {
    mockNotifs([notif({ id: 'nX', class: 'something_new', payload: {} })]);
    render(<NotificationsPanel />);
    expect(screen.getByText(/something_new/)).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    mockNotifs([]);
    render(<NotificationsPanel />);
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('renders the empty state when the response has no notifications field', () => {
    useApi.mockReturnValue({ data: {}, loading: false, error: null, refetch: vi.fn() });
    render(<NotificationsPanel />);
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  it('renders a loading state', () => {
    mockNotifs([], { loading: true });
    render(<NotificationsPanel />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders an error state', () => {
    mockNotifs([], { error: '500' });
    render(<NotificationsPanel />);
    expect(screen.getByText(/couldn.t load|failed|error/i)).toBeInTheDocument();
  });

  it('caps the list at 20 with a "latest 20" note when more exist', () => {
    const many = Array.from({ length: 25 }, (_, i) => notif({ id: `m${i}`, payload: { counterparty_name: `Co ${i}`, decision: 'approved', tier_label: 'Connection', decided_by: 'x' } }));
    mockNotifs(many);
    render(<NotificationsPanel />);
    expect(screen.getAllByTestId(/^notif-/)).toHaveLength(20);
    expect(screen.getByText(/latest 20/i)).toBeInTheDocument();
  });
});
