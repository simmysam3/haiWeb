import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const listRunTemplates = vi.fn();
const createRunTemplate = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) => async (request: NextRequest) => {
    const client = { listRunTemplates, createRunTemplate };
    return handler({ client, request, session: { user: { id: 'u-1' } }, params: {} });
  },
}));

beforeEach(() => {
  listRunTemplates.mockReset();
  createRunTemplate.mockReset();
});

const url = 'http://localhost/api/account/sonar/audit/definitions';

describe('GET /api/account/sonar/audit/definitions', () => {
  it('returns only audit templates from a mixed list', async () => {
    listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't-1', observation_class: 'audit', template_name: 'Audit A' },
        { template_id: 't-2', observation_class: 'watcher', template_name: 'Watcher B' },
        { template_id: 't-3', observation_class: 'phantom_demand', template_name: 'PD C' },
        { template_id: 't-4', observation_class: 'audit', template_name: 'Audit D' },
      ],
    });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
    expect(body.templates.map((t: { template_id: string }) => t.template_id)).toEqual(['t-1', 't-4']);
  });

  it('returns empty array when no audit templates exist', async () => {
    listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't-1', observation_class: 'watcher', template_name: 'Watcher A' },
      ],
    });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.templates).toEqual([]);
  });

  it('preserves the templates envelope key', async () => {
    listRunTemplates.mockResolvedValue({ templates: [] });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body).toHaveProperty('templates');
  });
});

describe('POST /api/account/sonar/audit/definitions', () => {
  it('forces observation_class=audit even when body says watcher', async () => {
    createRunTemplate.mockResolvedValue({ template: { template_id: 'new-1', observation_class: 'audit' } });
    const { POST } = await import('../route');
    const req = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({ template_name: 'My Watcher', observation_class: 'watcher' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(createRunTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ observation_class: 'audit' }),
    );
  });

  it('forces observation_class=audit when body omits it', async () => {
    createRunTemplate.mockResolvedValue({ template: { template_id: 'new-2', observation_class: 'audit' } });
    const { POST } = await import('../route');
    const req = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({ template_name: 'Unnamed' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(createRunTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ observation_class: 'audit' }),
    );
    const body = await res.json();
    expect(body).toHaveProperty('template');
  });

  it('forces observation_class=audit even when body says phantom_demand', async () => {
    createRunTemplate.mockResolvedValue({ template: { template_id: 'new-3', observation_class: 'audit' } });
    const { POST } = await import('../route');
    const req = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({ template_name: 'PD run', observation_class: 'phantom_demand' }),
      headers: { 'content-type': 'application/json' },
    });
    await POST(req, { params: Promise.resolve({}) });
    const call = createRunTemplate.mock.calls[0][0];
    expect(call.observation_class).toBe('audit');
    expect(call.template_name).toBe('PD run');
  });
});
