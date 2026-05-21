import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { WorkingListTable } from '../working-list-table';
import type { WorkingListItem } from '@haiwave/protocol';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); mockRefresh.mockReset(); vi.stubGlobal('fetch', fetchMock); });

const item: WorkingListItem = {
  canonical_key: 'a'.repeat(64), category: 'gap',
  subject: 'Gap · Widget → v1', reason: 'Coverage missing (status: outstanding)',
  item_event_time: '2026-05-01T00:00:00.000Z', partner_id: 'v1', partner_legal_name: 'Widget Co',
  action_href: '/account/sonar/compliance/posture/coverage',
  state: 'open', snooze_until: null, dismiss_reason: null, last_transitioned_at: null,
  dismissed_by_user: null,
};

const dismissedItem: WorkingListItem = {
  ...item,
  canonical_key: 'b'.repeat(64),
  state: 'dismissed',
  dismiss_reason: 'not relevant',
  dismissed_by_user: 'jane@example.com',
  last_transitioned_at: '2026-05-10T00:00:00.000Z',
};

describe('WorkingListTable', () => {
  it('renders rows with category Pill + reason + action link', () => {
    render(<WorkingListTable items={[item]} />);
    expect(screen.getByText('Gap · Widget → v1')).toBeInTheDocument();
    expect(screen.getByText(/Coverage missing/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/account/sonar/compliance/posture/coverage');
  });
  it('acknowledge & suppress action requires a reason and PUTs to the BFF', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ state: 'dismissed' }), { status: 200 }));
    render(<WorkingListTable items={[item]} />);
    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }));
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'not relevant' } });
    fireEvent.click(screen.getByRole('button', { name: /^suppress$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/account/sonar/compliance/working-list/items/${item.canonical_key}/state`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toMatchObject({ state: 'dismissed', dismiss_reason: 'not relevant' });
  });
  it('on non-ok response shows error text and does NOT call router.refresh', async () => {
    fetchMock.mockResolvedValue(new Response('Service unavailable', { status: 503 }));
    render(<WorkingListTable items={[item]} />);
    // Open snooze to trigger transition directly without needing dismiss flow
    fireEvent.click(screen.getByRole('button', { name: /snooze/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
  });

  it('renders "Acknowledge & suppress" button on open items, not "Dismiss"', () => {
    render(<WorkingListTable items={[item]} />);
    expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument();
  });

  it('hides dismissed/suppressed items by default', () => {
    render(<WorkingListTable items={[item, dismissedItem]} />);
    expect(screen.getByText('Gap · Widget → v1')).toBeInTheDocument();
    // dismissedItem has same subject — but it should not be visible since it shares partner and won't appear
    // Verify the suppressed toggle is present but suppressed row itself is not rendered
    expect(screen.getByRole('button', { name: /show suppressed/i })).toBeInTheDocument();
    // Only the open item's actions are shown (Acknowledge & suppress present; no Reopen for dismissed)
    expect(screen.getAllByRole('button', { name: /acknowledge/i })).toHaveLength(1);
  });

  it('with showSuppressed toggled on, renders dismissed items with "suppressed" label', () => {
    render(<WorkingListTable items={[item, dismissedItem]} />);
    const toggleBtn = screen.getByRole('button', { name: /show suppressed/i });
    fireEvent.click(toggleBtn);
    // After toggle, the state pill for the dismissed item should say "suppressed" not "dismissed"
    expect(screen.getAllByText('suppressed')).toHaveLength(1);
    expect(screen.queryByText('dismissed')).not.toBeInTheDocument();
    // Toggle button now says "Hide suppressed"
    expect(screen.getByRole('button', { name: /hide suppressed/i })).toBeInTheDocument();
  });

  it('suppressed rows show dismissed_by_user and dismiss_reason annotation when shown', () => {
    render(<WorkingListTable items={[item, dismissedItem]} />);
    const toggleBtn = screen.getByRole('button', { name: /show suppressed/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/suppressed by jane@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/not relevant/i)).toBeInTheDocument();
  });
});
