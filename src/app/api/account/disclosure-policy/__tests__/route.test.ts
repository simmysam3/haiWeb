import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

const BASE = 'http://localhost/api/account/disclosure-policy';
// The whole cell, as the full-replace PUT requires (PF P5).
const CELL = { attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: true };

describe('/api/account/disclosure-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET forwards to haiCore and returns the { matrix } body verbatim', async () => {
    const payload = { matrix: [{ ...CELL, source: 'participant' }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest(BASE), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy');
    expect(await res.json()).toEqual(payload);
  });

  it('PUT returns 403 for a non-editor role before calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest(BASE, { method: 'PUT', body: JSON.stringify(CELL) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('PUT forwards the WHOLE cell an account_admin sent, shortfall flag included', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ row: { ...CELL, source: 'participant' } }) });
    const res = await PUT(new NextRequest(BASE, { method: 'PUT', body: JSON.stringify(CELL) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy', expect.objectContaining({ method: 'PUT', body: JSON.stringify(CELL) }));
    expect(JSON.parse(fetchRaw.mock.calls[0][1].body as string)).toHaveProperty('disclose_shortfall_quantity');
    expect(res.status).toBe(200);
  });
});
