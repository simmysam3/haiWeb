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

describe('GET /api/account/sonar/templates', () => {
  it('returns the list from HaiwaveClient.listRunTemplates', async () => {
    listRunTemplates.mockResolvedValue({ templates: [] });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost/api/account/sonar/templates'), {
      params: Promise.resolve({}),
    });
    expect(await res.json()).toEqual({ templates: [] });
    expect(listRunTemplates).toHaveBeenCalled();
  });
});

describe('POST /api/account/sonar/templates', () => {
  it('forwards the body to HaiwaveClient.createRunTemplate', async () => {
    createRunTemplate.mockResolvedValue({ template: { template_id: 'new' } });
    const { POST } = await import('../route');
    const body = { template_name: 't', observation_class: 'audit' };
    const req = new NextRequest('http://localhost/api/account/sonar/templates', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(await res.json()).toEqual({ template: { template_id: 'new' } });
    expect(createRunTemplate).toHaveBeenCalledWith(body);
  });
});
