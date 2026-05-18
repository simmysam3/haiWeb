import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { WorkingListTable } from '../working-list-table';
import type { WorkingListItem } from '@haiwave/protocol';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

const item: WorkingListItem = {
  canonical_key: 'a'.repeat(64), category: 'nomination',
  subject: 'Nomination · Widget → v1', reason: 'Awaiting response (status: outstanding)',
  item_event_time: '2026-05-01T00:00:00.000Z', partner_id: 'v1',
  action_href: '/account/sonar/compliance/posture/nominations',
  state: 'open', snooze_until: null, dismiss_reason: null, last_transitioned_at: null,
};

describe('WorkingListTable', () => {
  it('renders rows with category Pill + reason + action link', () => {
    render(<WorkingListTable items={[item]} />);
    expect(screen.getByText('Nomination · Widget → v1')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting response/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/account/sonar/compliance/posture/nominations');
  });
  it('dismiss action requires a reason and PUTs to the BFF', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ state: 'dismissed' }), { status: 200 }));
    render(<WorkingListTable items={[item]} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    fireEvent.change(screen.getByPlaceholderText(/reason/i), { target: { value: 'not relevant' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/account/sonar/compliance/working-list/items/${item.canonical_key}/state`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toMatchObject({ state: 'dismissed', dismiss_reason: 'not relevant' });
  });
});
