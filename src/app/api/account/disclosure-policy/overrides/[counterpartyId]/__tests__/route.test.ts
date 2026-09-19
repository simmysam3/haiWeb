import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { PUT } from '../route';

// haiCore parses this param with z.string().uuid() — a short id is a 400 upstream.
const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const OVERRIDE = { attribute_class_id: 'availability', disclosure: 'qualified', disclose_shortfall_quantity: null };

describe('PUT /api/account/disclosure-policy/overrides/[counterpartyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-editor role before calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(OVERRIDE) }), { params: Promise.resolve({ counterpartyId: COUNTERPARTY }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards the override to the counterparty path, and the body carries no trust_class', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ override: { counterparty_participant_id: COUNTERPARTY, ...OVERRIDE } }) });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(OVERRIDE) }), { params: Promise.resolve({ counterpartyId: COUNTERPARTY }) });
    expect(fetchRaw).toHaveBeenCalledWith(`/disclosure-policy/overrides/${COUNTERPARTY}`, expect.objectContaining({ method: 'PUT' }));
    expect(JSON.parse(fetchRaw.mock.calls[0][1].body as string)).not.toHaveProperty('trust_class');
    expect(res.status).toBe(200);
  });
});
