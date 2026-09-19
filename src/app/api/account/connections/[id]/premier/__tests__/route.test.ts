import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { PUT } from '../route';

describe('PUT /api/account/connections/[id]/premier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards { premier: true } to haiCore and returns the upstream body and status, including a 409 NOT_A_TRADING_PAIR verbatim', async () => {
    const okPayload = { connection_id: 'conn-1', trust_class: 'premier_partner' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(okPayload) });
    const okRes = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/connections/conn-1/premier', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ premier: true }) }));
    expect(okRes.status).toBe(200);

    const conflictBody = { error: { code: 'NOT_A_TRADING_PAIR' } };
    fetchRaw.mockResolvedValueOnce({ status: 409, text: async () => JSON.stringify(conflictBody) });
    const conflictRes = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(conflictRes.status).toBe(409);
    expect(await conflictRes.json()).toEqual(conflictBody);
  });
});
