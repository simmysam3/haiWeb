import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getThrottledRunsCount, getSession, getToken } = vi.hoisted(() => ({
  getThrottledRunsCount: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getThrottledRunsCount }),
}));

import { GET } from '../count/route';

const baseUrl = 'http://localhost/api/account/sonar/runs/throttled/count';

describe('GET /api/account/sonar/runs/throttled/count', () => {
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
    expect(getThrottledRunsCount).not.toHaveBeenCalled();
  });

  it('returns 200 with counts envelope from haiCore', async () => {
    getThrottledRunsCount.mockResolvedValueOnce({ audit: 2, watcher: 1, total: 3 });
    const res = await GET(new NextRequest(baseUrl), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(getThrottledRunsCount).toHaveBeenCalled();
    expect(await res.json()).toEqual({ audit: 2, watcher: 1, total: 3 });
  });

  it('returns 200 with zeros when no throttled runs', async () => {
    getThrottledRunsCount.mockResolvedValueOnce({ audit: 0, watcher: 0, total: 0 });
    const res = await GET(new NextRequest(baseUrl), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audit: 0, watcher: 0, total: 0 });
  });

  // NOTE: 5xx haiCore failures are handled by withHaiCore (returns 500 in
  // production, fallback in dev). The canonical pattern used here does not
  // try to override process.env.NODE_ENV — tested end-to-end by with-hai-core
  // unit tests instead.
});
