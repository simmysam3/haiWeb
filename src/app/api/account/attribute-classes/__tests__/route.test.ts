import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/attribute-classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('is readable by any session role and returns the { attribute_classes } envelope verbatim', async () => {
    const payload = { attribute_classes: [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted' }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes');
    expect(await res.json()).toEqual(payload);
  });
});
