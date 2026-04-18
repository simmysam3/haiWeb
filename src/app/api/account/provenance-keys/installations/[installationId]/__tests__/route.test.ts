import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  updateInstallation: vi.fn(),
  removeInstallation: vi.fn(),
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: unknown, ctx: { params: Promise<{ installationId: string }> }) =>
      handler({
        client: mockClient,
        session: { participant: { id: 'pid' } },
        request,
        params: await ctx.params,
      }),
}));

describe('/api/account/provenance-keys/installations/[installationId]', () => {
  beforeEach(() => {
    mockClient.updateInstallation.mockReset();
    mockClient.removeInstallation.mockReset();
  });

  it('PATCH forwards installationId and body to updateInstallation', async () => {
    mockClient.updateInstallation.mockResolvedValueOnce({ installation_id: 'i1' });
    const { PATCH } = await import('../route');
    const body = { accepted_requested_fields: ['facility_country'] };
    const request = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(request, { params: Promise.resolve({ installationId: 'i1' }) });
    expect(mockClient.updateInstallation).toHaveBeenCalledWith('i1', body);
    expect(res.status).toBe(200);
  });

  it('DELETE forwards installationId to removeInstallation', async () => {
    mockClient.removeInstallation.mockResolvedValueOnce({ installation_id: 'i1', removed_at: 'now' });
    const { DELETE } = await import('../route');
    const request = new Request('http://localhost/x', { method: 'DELETE' });
    const res = await DELETE(request, { params: Promise.resolve({ installationId: 'i1' }) });
    expect(mockClient.removeInstallation).toHaveBeenCalledWith('i1');
    expect(res.status).toBe(200);
  });
});
