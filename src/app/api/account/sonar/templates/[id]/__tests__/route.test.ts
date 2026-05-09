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
  it('calls deleteRunTemplate with the id', async () => {
    deleteRunTemplate.mockResolvedValue({ deleted: true });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/templates/abc', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    );
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleteRunTemplate).toHaveBeenCalledWith('abc');
  });
});
