import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/with-hai-core', () => ({ withHaiCore: (h: unknown) => h }));
import { GET } from '../route';
import { PUT } from '../items/[canonical_key]/state/route';

describe('working-list BFF', () => {
  it('GET forwards filters to client.listWorkingList', async () => {
    const client = { listWorkingList: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    const request = { url: 'http://x/api/account/sonar/compliance/working-list?categories=gap&sort=recency' } as Request;
    const res = await (GET as unknown as (ctx: { client: typeof client; request: Request }) => Promise<Response>)({ client, request });
    expect(client.listWorkingList).toHaveBeenCalledWith(expect.objectContaining({ categories: ['gap'], sort: 'recency' }));
    expect(res.status).toBe(200);
  });
  it('PUT forwards body + key to client.transitionWorkingListItem', async () => {
    const client = { transitionWorkingListItem: vi.fn().mockResolvedValue({ canonical_key: 'k', state: 'open' }) };
    const key = 'a'.repeat(64);
    const request = { json: async () => ({ state: 'open' }) } as unknown as Request;
    const res = await (PUT as unknown as (ctx: { client: typeof client; request: Request; params: { canonical_key: string } }) => Promise<Response>)({ client, request, params: { canonical_key: key } });
    expect(client.transitionWorkingListItem).toHaveBeenCalledWith(key, { state: 'open' });
    expect(res.status).toBe(200);
  });
});
