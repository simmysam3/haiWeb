import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockClient = { installKey: vi.fn() };

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: unknown) =>
      handler({ client: mockClient, session: { participant: { id: 'pid' } }, request, params: {} }),
}));

describe('POST /api/account/provenance-keys/installations', () => {
  beforeEach(() => mockClient.installKey.mockReset());

  it('forwards the JSON body to client.installKey', async () => {
    mockClient.installKey.mockResolvedValueOnce({ installation_id: 'i1' });
    const { POST } = await import('../route');
    const body = { key_hash: 'h', accepted_requested_fields: [] };
    const request = new NextRequest('http://localhost/api/account/provenance-keys/installations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(request, { params: Promise.resolve({}) });
    expect(mockClient.installKey).toHaveBeenCalledWith(body);
    const json = await res.json();
    expect(json.installation_id).toBe('i1');
  });
});
