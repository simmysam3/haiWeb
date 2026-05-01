import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({
  fetchRaw: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    fetchRaw,
  }),
}));

import { GET } from '../route';

const url = 'http://localhost/api/account/sonar/phantom-demand/reports/latest';

describe('GET /api/account/sonar/phantom-demand/reports/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards the { window_id } body from haiCore on success', async () => {
    const window_id = '00000000-0000-0000-0000-0000000000aa';
    fetchRaw.mockResolvedValueOnce(
      new Response(JSON.stringify({ window_id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ window_id });
    expect(fetchRaw).toHaveBeenCalledWith(
      '/sonar/phantom-demand/reports/latest',
      { headers: { Accept: 'application/json' } },
    );
  });
});
