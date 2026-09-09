import { describe, it, expect, vi } from 'vitest';
import { requestFor } from '@/test/role-gate';

const state = vi.hoisted(() => ({
  results: [] as unknown[],
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
    createHaiwaveClient: vi.fn(() => ({ searchParticipants: async () => ({ results: state.results }) })),
  };
});

import { GET } from '../route';

/**
 * v1.90 scope-from-document F1: `company_name` is `dba_name ?? legal_name`, so a
 * consumer comparing a spelling against it alone misses a participant found by
 * its OTHER name. The DTO carries both, additively.
 */
describe('GET /api/account/directory — a participant carries both of its names', () => {
  it('emits legal_name and dba_name alongside the display company_name', async () => {
    state.results = [
      {
        participant: { id: 'p-acme', legal_name: 'Acme Industrial Ltd', dba_name: 'Acme' },
        relationship_state: 'none',
      },
    ];

    const res = await GET(requestFor('GET', '/api/account/directory?q=Acme%20Industrial%20Ltd'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const [hit] = await res.json();

    expect(hit).toMatchObject({
      id: 'p-acme',
      company_name: 'Acme',
      legal_name: 'Acme Industrial Ltd',
      dba_name: 'Acme',
    });
  });

  it('carries no dba_name key for a participant that has none', async () => {
    state.results = [{ participant: { id: 'p-bolt', legal_name: 'Bolt Co', dba_name: null } }];

    const res = await GET(requestFor('GET', '/api/account/directory?q=Bolt%20Co'), {
      params: Promise.resolve({}),
    });
    const [hit] = await res.json();

    expect(hit).toMatchObject({ company_name: 'Bolt Co', legal_name: 'Bolt Co' });
    expect(hit).not.toHaveProperty('dba_name');
  });
});
