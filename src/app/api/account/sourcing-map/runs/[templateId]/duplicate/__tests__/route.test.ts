import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionFor } from '@/test/role-gate';
import { VOMERO_IDS, vomeroRunTemplate } from '@/lib/sourcing-map/__fixtures__/vomero';
import { smReq, smCtx, haiCoreOk } from '@/test/sourcing-map-bff-harness';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: () => true }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(sessionFor('account_admin'));
  getToken.mockResolvedValue('header.payload.signature');
  fetchRaw.mockResolvedValue(haiCoreOk({ ok: true }));
});

describe('/api/account/sourcing-map/runs/[templateId]/duplicate', () => {
  it('POST reads the template and creates "<name> (copy)" with the same scope (demand only)', async () => {
    fetchRaw
      .mockResolvedValueOnce(haiCoreOk({ template: vomeroRunTemplate }))
      .mockResolvedValueOnce(haiCoreOk({ template: { ...vomeroRunTemplate, template_id: VOMERO_IDS.executionOld } }, 201));
    const { POST } = await import('../route');
    const res = await POST(smReq('POST', '/x'), smCtx({ templateId: VOMERO_IDS.template }));
    expect(fetchRaw.mock.calls[0]![0]).toBe(`/sonar/templates/${VOMERO_IDS.template}`);
    const [path, init] = fetchRaw.mock.calls[1]!;
    expect(path).toBe('/sonar/templates');
    expect(JSON.parse(init.body)).toEqual({
      observation_class: 'sourcing_map',
      template_name: 'Line A base (copy)',
      scope: vomeroRunTemplate.scope,
      cadence: vomeroRunTemplate.cadence,
      enabled: vomeroRunTemplate.enabled,
      retention_days: vomeroRunTemplate.retention_days,
    });
    expect(res.status).toBe(201);
  });

  it('truncates a long name so the copy fits the 200-character limit', async () => {
    const long = 'L'.repeat(200);
    fetchRaw
      .mockResolvedValueOnce(haiCoreOk({ template: { ...vomeroRunTemplate, template_name: long } }))
      .mockResolvedValueOnce(haiCoreOk({}, 201));
    const { POST } = await import('../route');
    await POST(smReq('POST', '/x'), smCtx({ templateId: VOMERO_IDS.template }));
    const name = JSON.parse(fetchRaw.mock.calls[1]![1].body).template_name as string;
    expect(name.length).toBe(200);
    expect(name.endsWith(' (copy)')).toBe(true);
  });
});
