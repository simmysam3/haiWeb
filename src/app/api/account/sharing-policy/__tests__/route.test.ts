import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockClient = {
  getSharingPolicy: vi.fn(),
  upsertSharingPolicy: vi.fn(),
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: unknown) =>
      handler({ client: mockClient, session: { participant: { id: 'pid' } }, request, params: {} }),
}));

describe('/api/account/sharing-policy', () => {
  beforeEach(() => {
    mockClient.getSharingPolicy.mockReset();
    mockClient.upsertSharingPolicy.mockReset();
  });

  it('GET delegates to client.getSharingPolicy', async () => {
    mockClient.getSharingPolicy.mockResolvedValueOnce({ shared_fields: ['facility_country'] });
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/x', { method: 'GET' });
    const res = await GET(request, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(json.shared_fields).toEqual(['facility_country']);
  });

  it('PUT forwards body to upsertSharingPolicy (preserves dry_run flag)', async () => {
    mockClient.upsertSharingPolicy.mockResolvedValueOnce({ policy: { shared_fields: [] }, warnings: [] });
    const { PUT } = await import('../route');
    const body = { shared_fields: [], dry_run: true };
    const request = new NextRequest('http://localhost/x', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(request, { params: Promise.resolve({}) });
    expect(mockClient.upsertSharingPolicy).toHaveBeenCalledWith(body);
    expect(res.status).toBe(200);
  });
});
