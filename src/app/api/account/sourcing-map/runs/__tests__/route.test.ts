import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionFor } from '@/test/role-gate';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
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

describe('/api/account/sourcing-map/runs', () => {
  it('POST creates a sourcing_map template with the observation class forced and the defaults filled', async () => {
    const scope = { kind: 'sourcing_map', project_id: VOMERO_IDS.project, products: [] };
    const { POST } = await import('../route');
    await POST(smReq('POST', '/x', { template_name: 'Line A base', scope, observation_class: 'audit' }), smCtx({}));
    const [path, init] = fetchRaw.mock.calls[0]!;
    expect(path).toBe('/sonar/templates');
    expect(JSON.parse(init.body)).toEqual({
      observation_class: 'sourcing_map',
      template_name: 'Line A base',
      scope: { ...scope, depth_cap: 5, seat_weekly_capacity: null },
      cadence: { kind: 'manual_only' },
      enabled: true,
      retention_days: 365,
    });
  });

  it('POST refuses an invalid body with 400 and never calls haiCore', async () => {
    const { POST } = await import('../route');
    const res = await POST(smReq('POST', '/x', { template_name: '' }), smCtx({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(fetchRaw).not.toHaveBeenCalled();
  });
});
