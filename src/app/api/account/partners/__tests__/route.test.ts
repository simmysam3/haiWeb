import { describe, it, expect, vi } from 'vitest';
import { requestFor } from '@/test/role-gate';

const state = vi.hoisted(() => ({
  connections: [] as unknown[],
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { sessionFor } = await import('@/test/role-gate');
  return {
    ...actual,
    getSession: vi.fn(async () => sessionFor('account_owner')),
    getToken: vi.fn(async () => 'header.payload.signature'),
  };
});
vi.mock('@/lib/haiwave-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/haiwave-api')>('@/lib/haiwave-api');
  return {
    ...actual,
    createHaiwaveClient: vi.fn(() => ({ listActiveConnections: async () => state.connections })),
  };
});

import { GET } from '../route';

describe('GET /api/account/partners — the DTO states only what haiCore records (QUA-web-api-2-07)', () => {
  it('carries no manifest_progress: haiCore\'s connection record has no completeness figure', async () => {
    state.connections = [{
      connection_id: 'conn-1',
      partner_participant_id: 'p-acme',
      partner_name: 'Acme Metals',
      partner_location: 'Ohio',
      partner_industry: 'Metals',
      relationship_state: 'approved',
      invite_yours: false,
      invite_theirs: false,
      established_at: '2026-08-01T00:00:00Z',
    }];

    const res = await GET(requestFor('GET', '/api/account/partners'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const [partner] = await res.json();

    expect(partner).toMatchObject({ id: 'p-acme', company_name: 'Acme Metals', status: 'approved', connection_id: 'conn-1' });
    expect(partner).not.toHaveProperty('manifest_progress');
  });
});
