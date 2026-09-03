import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getRunTemplate = vi.fn();
const updateRunTemplate = vi.fn();
const deleteRunTemplate = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, routeCtx: { params: Promise<{ id: string }> }) => {
      const client = { getRunTemplate, updateRunTemplate, deleteRunTemplate };
      return handler({
        client,
        request,
        session: { user: { id: 'u-1' } },
        params: await routeCtx.params,
      });
    },
}));

beforeEach(() => {
  getRunTemplate.mockReset();
  updateRunTemplate.mockReset();
  deleteRunTemplate.mockReset();
});

describe('GET /api/account/sonar/templates/[id]', () => {
  it('returns the template by id', async () => {
    getRunTemplate.mockResolvedValue({ template: { template_id: 'abc' } });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest('http://localhost/api/account/sonar/templates/abc'),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(await res.json()).toEqual({ template: { template_id: 'abc' } });
    expect(getRunTemplate).toHaveBeenCalledWith('abc');
  });
});

describe('PATCH /api/account/sonar/templates/[id]', () => {
  it('forwards the body to updateRunTemplate', async () => {
    updateRunTemplate.mockResolvedValue({ template: { template_id: 'abc' } });
    const { PATCH } = await import('../route');
    const req = new NextRequest('http://localhost/api/account/sonar/templates/abc', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
      headers: { 'content-type': 'application/json' },
    });
    await PATCH(req, { params: Promise.resolve({ id: 'abc' }) });
    expect(updateRunTemplate).toHaveBeenCalledWith('abc', { enabled: false });
  });
});

describe('DELETE /api/account/sonar/templates/[id]', () => {
  it('calls deleteRunTemplate with the id and no runs param when ?runs= is absent', async () => {
    deleteRunTemplate.mockResolvedValue({ deleted: true, runs: { disposition: 'keep', affected: 0 } });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/templates/abc', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, runs: { disposition: 'keep', affected: 0 } });
    expect(deleteRunTemplate).toHaveBeenCalledWith('abc', { runs: undefined });
  });

  // v1.85 (2026-09-02): D-206 — the caller's disposition for the template's
  // prior runs is forwarded from the ?runs= query param.
  it('forwards ?runs=archive to deleteRunTemplate', async () => {
    deleteRunTemplate.mockResolvedValue({ deleted: true, runs: { disposition: 'archive', affected: 3 } });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/templates/abc?runs=archive', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true, runs: { disposition: 'archive', affected: 3 } });
    expect(deleteRunTemplate).toHaveBeenCalledWith('abc', { runs: 'archive' });
  });

  // v1.85 (2026-09-02): a pre-3.80.0 haiCore answers DELETE with 204 and the
  // client resolves `null` (no JSON body) — the route must not throw on that.
  it('passes a null result through without throwing (pre-3.80.0 haiCore 204)', async () => {
    deleteRunTemplate.mockResolvedValue(null);
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/templates/abc', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns 400 invalid_runs for an unrecognized ?runs= value, without calling deleteRunTemplate', async () => {
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/templates/abc?runs=purge', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_runs' });
    expect(deleteRunTemplate).not.toHaveBeenCalled();
  });
});
