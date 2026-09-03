import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// v1.85 (2026-09-02): D-206 — unlike route.test.ts (which stubs out
// with-hai-core.ts entirely), this file exercises the REAL withHaiCore
// wrapper so the 409 RUNS_IN_FLIGHT pass-through it's responsible for is
// actually verified, not just re-asserted against a hand-rolled mock.
const { deleteRunTemplate, getSession, getToken } = vi.hoisted(() => ({
  deleteRunTemplate: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ deleteRunTemplate }),
}));

import { DELETE } from '../route';

describe('DELETE /api/account/sonar/audit/definitions/[id] — haiCore error pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it("passes a 409 RUNS_IN_FLIGHT error through with haiCore's status and body", async () => {
    deleteRunTemplate.mockRejectedValueOnce(
      Object.assign(new Error('haiCore DELETE /sonar/templates/def-9: 409 {...}'), {
        status: 409,
        haiCoreBody: { error: { code: 'RUNS_IN_FLIGHT', details: { running_count: 1 } } },
      }),
    );

    const res = await DELETE(
      new NextRequest('http://localhost/api/account/sonar/audit/definitions/def-9?runs=archive', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'def-9' }) },
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: 'RUNS_IN_FLIGHT', details: { running_count: 1 } },
    });
  });
});
