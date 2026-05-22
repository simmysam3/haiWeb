import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const updateRunTemplate = vi.fn();
const deleteRunTemplate = vi.fn();
const triggerRunTemplate = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, routeCtx: { params: Promise<{ id: string }> }) => {
      const client = { updateRunTemplate, deleteRunTemplate, triggerRunTemplate };
      return handler({
        client,
        request,
        session: { user: { id: 'u-1' } },
        params: await routeCtx.params,
      });
    },
}));

beforeEach(() => {
  updateRunTemplate.mockReset();
  deleteRunTemplate.mockReset();
  triggerRunTemplate.mockReset();
});

const baseUrl = 'http://localhost/api/account/sonar/audit/definitions';

describe('PATCH /api/account/sonar/audit/definitions/[id]', () => {
  it('forwards the body to updateRunTemplate with the id', async () => {
    updateRunTemplate.mockResolvedValue({ template: { template_id: 'def-1' } });
    const { PATCH } = await import('../route');
    const req = new NextRequest(`${baseUrl}/def-1`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'def-1' }) });
    expect(await res.json()).toEqual({ template: { template_id: 'def-1' } });
    expect(updateRunTemplate).toHaveBeenCalledWith('def-1', { enabled: false });
  });

  it('gracefully handles an empty body', async () => {
    updateRunTemplate.mockResolvedValue({ template: { template_id: 'def-2' } });
    const { PATCH } = await import('../route');
    const req = new NextRequest(`${baseUrl}/def-2`, { method: 'PATCH' });
    await PATCH(req, { params: Promise.resolve({ id: 'def-2' }) });
    expect(updateRunTemplate).toHaveBeenCalledWith('def-2', {});
  });
});

describe('DELETE /api/account/sonar/audit/definitions/[id]', () => {
  it('calls deleteRunTemplate with the id and returns the result', async () => {
    deleteRunTemplate.mockResolvedValue({ deleted: true });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest(`${baseUrl}/def-3`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'def-3' }) },
    );
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleteRunTemplate).toHaveBeenCalledWith('def-3');
  });
});

describe('POST /api/account/sonar/audit/definitions/[id]/run', () => {
  it('calls triggerRunTemplate with the id and returns { run_id }', async () => {
    triggerRunTemplate.mockResolvedValue({ run_id: 'run-abc' });
    const { POST } = await import('../../[id]/run/route');
    const res = await POST(
      new NextRequest(`${baseUrl}/def-4/run`, { method: 'POST' }),
      { params: Promise.resolve({ id: 'def-4' }) },
    );
    expect(await res.json()).toEqual({ run_id: 'run-abc' });
    expect(triggerRunTemplate).toHaveBeenCalledWith('def-4');
  });
});
