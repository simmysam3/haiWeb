import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { POST } from '../route';

describe('POST /api/account/connections/[id]/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards to haiCore and returns 200 with the activated connection', async () => {
    const payload = { connection_id: 'conn-1', relationship_state: 'trading_pair' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/connections/conn-1/activate', expect.objectContaining({ method: 'POST' }));
    expect(res.status).toBe(200);
  });
});
