import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

describe('/api/account/room-participation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET returns the { global, per_class } state verbatim', async () => {
    const payload = { global: true, per_class: { availability: false } };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/room-participation');
    expect(await res.json()).toEqual(payload);
  });

  it('PUT returns 403 for a non-editor role', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ attribute_class_id: null, enabled: false }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards a global opt-out (attribute_class_id: null) verbatim', async () => {
    const body = { attribute_class_id: null, enabled: false };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(body) });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/room-participation', expect.objectContaining({ method: 'PUT', body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
  });
});
