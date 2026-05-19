import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

describe('working list client', () => {
  it('listWorkingList builds query params', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const c = createHaiwaveClient('jwt.tok.en', 'pid-1');
    await c.listWorkingList({ categories: ['gap', 'change'], partner_id: 'v1', status: 'open', sort: 'oldest_unresolved' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sonar/compliance/working-list?');
    expect(url).toContain('categories=gap%2Cchange');
    expect(url).toContain('partner_id=v1');
    expect(url).toContain('status=open');
    expect(url).toContain('sort=oldest_unresolved');
  });
  it('transitionWorkingListItem PUTs the body to the key path', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ canonical_key: 'k', state: 'snoozed' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const c = createHaiwaveClient('jwt.tok.en', 'pid-1');
    await c.transitionWorkingListItem('a'.repeat(64), { state: 'snoozed', snooze_until: '2026-06-01T00:00:00.000Z' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/sonar/compliance/working-list/items/' + 'a'.repeat(64) + '/state');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ state: 'snoozed', snooze_until: '2026-06-01T00:00:00.000Z' });
  });
});
