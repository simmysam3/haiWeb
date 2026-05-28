import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const listRunTemplates = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) => async (request: NextRequest) => {
    const client = { listRunTemplates };
    return handler({ client, request, session: { user: { id: 'u-1' } }, params: {} });
  },
}));

beforeEach(() => {
  listRunTemplates.mockReset();
});

const url = 'http://localhost/api/account/sonar/watcher/definitions';

describe('GET /api/account/sonar/watcher/definitions', () => {
  it('returns only watcher templates from a mixed list', async () => {
    listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't-1', observation_class: 'audit', template_name: 'Audit A' },
        { template_id: 't-2', observation_class: 'watcher', template_name: 'Watcher B' },
        { template_id: 't-3', observation_class: 'phantom_demand', template_name: 'PD C' },
        { template_id: 't-4', observation_class: 'watcher', template_name: 'Watcher D' },
      ],
    });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
    expect(body.templates.map((t: { template_id: string }) => t.template_id)).toEqual(['t-2', 't-4']);
  });

  it('returns empty array when no watcher templates exist', async () => {
    listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't-1', observation_class: 'audit', template_name: 'Audit A' },
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
