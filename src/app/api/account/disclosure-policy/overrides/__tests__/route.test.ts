import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/disclosure-policy/overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('is readable by any session role and returns the { overrides } envelope verbatim', async () => {
    const payload = { overrides: [{ counterparty_participant_id: '11111111-1111-4111-8111-111111111111', attribute_class_id: 'availability', disclosure: 'qualified', disclose_shortfall_quantity: null }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy/overrides');
    expect(await res.json()).toEqual(payload);
  });
});
