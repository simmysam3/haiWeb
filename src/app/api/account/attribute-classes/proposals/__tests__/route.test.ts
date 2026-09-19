import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, POST } from '../route';

describe('/api/account/attribute-classes/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET lists own proposals', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ proposals: [] }) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes/proposals');
    expect(res.status).toBe(200);
  });

  it('POST returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ attribute_class_id: 'moq' }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('POST forwards the proposal body verbatim and returns 201', async () => {
    const body = { attribute_class_id: 'moq', display_name: 'Minimum Order Quantity' }; // a passthrough: haiCore validates the fifteen keys
    fetchRaw.mockResolvedValueOnce({ status: 201, text: async () => JSON.stringify({ proposal: { id: 'prop-1', attribute_class_id: 'moq', status: 'pending' } }) });
    const res = await POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes/proposals', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(201);
  });
});
