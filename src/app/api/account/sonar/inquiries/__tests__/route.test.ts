import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/sonar/inquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('defaults to direction=inbound and limit=50 when absent', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ rows: [], next_cursor: null }) });
    await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/inquiries?direction=inbound&limit=50');
  });

  it('forwards direction, limit and cursor when given, and never places a participant id in the query string', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ rows: [], next_cursor: null }) });
    await GET(new NextRequest('http://x/api/account/sonar/inquiries?direction=outbound&limit=100&cursor=cur-1'), { params: Promise.resolve({}) });
    const calledPath = fetchRaw.mock.calls[0][0] as string;
    expect(calledPath).toBe('/inquiries?direction=outbound&limit=100&cursor=cur-1');
    expect(calledPath).not.toContain('participant');
  });

  it('returns the upstream { rows, next_cursor } envelope verbatim, and a 400 for an over-large limit verbatim', async () => {
    const payload = { rows: [{ inquiry_id: 'inq-1', outcome: 'satisfied' }], next_cursor: 'cur-2' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const okRes = await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(await okRes.json()).toEqual(payload);

    fetchRaw.mockResolvedValueOnce({ status: 400, text: async () => JSON.stringify({ error: { code: 'VALIDATION_ERROR' } }) });
    const badRes = await GET(new NextRequest('http://x/api/account/sonar/inquiries?limit=500'), { params: Promise.resolve({}) });
    expect(badRes.status).toBe(400);
  });

  // PF P15 / Q3 — the portal client has no inquiry:ask today.
  it('maps an upstream 403 to a 200 empty state flagged not_enabled', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 403, text: async () => JSON.stringify({ error: { code: 'FORBIDDEN' } }) });
    const res = await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows: [], next_cursor: null, not_enabled: true });
  });
});
