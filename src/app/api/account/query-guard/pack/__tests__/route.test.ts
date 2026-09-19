import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
// Item 14 (final fix wave): this route gates through forbidNonEditor (query-guard/_lib/authz.ts),
// which reads session.user.role directly and never calls hasRole — the mock member was dead.
vi.mock('@/lib/auth', () => ({ getSession, getToken }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

// PF P11 — the as-built body: the current pack, ITS figures, and the ceiling with its source.
const PACK_BODY = { pack: 'standard', figures: DEFAULT_INQUIRY_PACKS.standard, ceiling: { limit_per_hour: 50, source: 'platform_default' } };

describe('/api/account/query-guard/pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET returns the pack, its figures and the ceiling verbatim', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(PACK_BODY) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/query-guard/pack');
    expect(await res.json()).toEqual(PACK_BODY);
  });

  it('PUT returns 403 for a non-editor role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ pack: 'open' }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('PUT forwards the selected pack to haiCore', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ ...PACK_BODY, pack: 'open', figures: DEFAULT_INQUIRY_PACKS.open }) });
    await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ pack: 'open' }) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/query-guard/pack', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ pack: 'open' }) }));
  });
});
