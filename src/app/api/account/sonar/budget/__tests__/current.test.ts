import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getBudgetCurrent, getSession, getToken } = vi.hoisted(() => ({
  getBudgetCurrent: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getBudgetCurrent }),
}));

import { GET } from '../current/route';

const baseUrl = 'http://localhost/api/account/sonar/budget/current';

const MOCK_BUDGET = {
  participant_id: 'p-self',
  window_start: '2026-05-01T17:00:00.000Z',
  consumed: 42,
  remaining: 958,
  budget: 1000,
  // v1.30 PR-5: is_custom + probe-limit fields surfaced so HaiWeb can render
  // §7.2 "(custom)" labels without duplicating haiCore's PLATFORM_DEFAULT_*.
  is_custom: true,
  phantom_demand_inbound_probe_limit: 50,
  phantom_demand_inbound_probe_limit_is_custom: false,
};

describe('GET /api/account/sonar/budget/current', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 without a session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new NextRequest(baseUrl), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(getBudgetCurrent).not.toHaveBeenCalled();
  });

  it('returns 200 with the budget envelope from haiCore', async () => {
    getBudgetCurrent.mockResolvedValueOnce(MOCK_BUDGET);
    const res = await GET(new NextRequest(baseUrl), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(getBudgetCurrent).toHaveBeenCalled();
    expect(await res.json()).toEqual(MOCK_BUDGET);
  });

  // NOTE: 5xx haiCore failures are handled by withHaiCore (returns 500 in
  // production, fallback in dev). The canonical pattern used here does not
  // try to override process.env.NODE_ENV — tested end-to-end by with-hai-core
  // unit tests instead.
});
