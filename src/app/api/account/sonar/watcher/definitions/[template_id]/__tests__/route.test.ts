import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getRunTemplate = vi.fn();
const updateRunTemplate = vi.fn();
const deleteRunTemplate = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, routeCtx: { params: Promise<{ template_id: string }> }) => {
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

const baseUrl = 'http://localhost/api/account/sonar/watcher/definitions';

describe('GET /api/account/sonar/watcher/definitions/[template_id]', () => {
  it('returns 200 with the template for watcher-class templates', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-watch-1', observation_class: 'watcher', template_name: 'Watcher A' },
    });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest(`${baseUrl}/t-watch-1`, { method: 'GET' }),
      { params: Promise.resolve({ template_id: 't-watch-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.template_id).toBe('t-watch-1');
    expect(body.template.observation_class).toBe('watcher');
    expect(getRunTemplate).toHaveBeenCalledWith('t-watch-1');
  });

  it('returns 404 for audit-class templates', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-aud-1', observation_class: 'audit', template_name: 'Audit A' },
    });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest(`${baseUrl}/t-aud-1`, { method: 'GET' }),
      { params: Promise.resolve({ template_id: 't-aud-1' }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('returns 404 for phantom_demand-class templates', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-pd-1', observation_class: 'phantom_demand', template_name: 'PD A' },
    });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest(`${baseUrl}/t-pd-1`, { method: 'GET' }),
      { params: Promise.resolve({ template_id: 't-pd-1' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/account/sonar/watcher/definitions/[template_id]', () => {
  it('forwards the body to updateRunTemplate for watcher-class templates', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-watch-2', observation_class: 'watcher', template_name: 'Watcher B' },
    });
    updateRunTemplate.mockResolvedValue({
      template: { template_id: 't-watch-2', observation_class: 'watcher', enabled: false },
    });
    const { PATCH } = await import('../route');
    const req = new NextRequest(`${baseUrl}/t-watch-2`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ template_id: 't-watch-2' }) });
    expect(res.status).toBe(200);
    expect(updateRunTemplate).toHaveBeenCalledWith('t-watch-2', { enabled: false });
  });

  it('returns 404 for audit-class templates without calling updateRunTemplate', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-aud-2', observation_class: 'audit', template_name: 'Audit B' },
    });
    const { PATCH } = await import('../route');
    const req = new NextRequest(`${baseUrl}/t-aud-2`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req, { params: Promise.resolve({ template_id: 't-aud-2' }) });
    expect(res.status).toBe(404);
    expect(updateRunTemplate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/account/sonar/watcher/definitions/[template_id]', () => {
  it('calls deleteRunTemplate for watcher-class templates', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-watch-3', observation_class: 'watcher', template_name: 'Watcher C' },
    });
    deleteRunTemplate.mockResolvedValue({ deleted: true });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest(`${baseUrl}/t-watch-3`, { method: 'DELETE' }),
      { params: Promise.resolve({ template_id: 't-watch-3' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleteRunTemplate).toHaveBeenCalledWith('t-watch-3');
  });

  it('returns 404 for audit-class templates without calling deleteRunTemplate', async () => {
    getRunTemplate.mockResolvedValue({
      template: { template_id: 't-aud-3', observation_class: 'audit', template_name: 'Audit C' },
    });
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new NextRequest(`${baseUrl}/t-aud-3`, { method: 'DELETE' }),
      { params: Promise.resolve({ template_id: 't-aud-3' }) },
    );
    expect(res.status).toBe(404);
    expect(deleteRunTemplate).not.toHaveBeenCalled();
  });
});
