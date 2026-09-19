import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/sonar/inquiries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('forwards to /inquiries/:id and returns an answered verdict body verbatim', async () => {
    const verdict = { inquiry_id: '22222222-2222-4222-8222-222222222222', outcome: 'satisfied', form_answered: 'qualified', granularity: 'aggregate', basis: 'declared_value', informational_use_only: true, commitment: { commitment_id: 'cm-1', hash: 'h'.repeat(8), signature: 's'.repeat(8), signed_at: '2026-09-16T00:00:00Z' } };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(verdict) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'inq-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/inquiries/inq-1');
    expect(await res.json()).toEqual(verdict);
  });

  it('returns a { inquiry_id, status: "pending" } body verbatim while the inquiry is unanswered', async () => {
    const pending = { inquiry_id: '33333333-3333-4333-8333-333333333333', status: 'pending' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(pending) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'inq-2' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pending);
  });

  // PF P15 / Q3 — the same fixed state as the list route, for both causes of a 403.
  it('maps the upstream 403 to the fixed not-enabled state rather than leaking which cause it was', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 403, text: async () => JSON.stringify({ error: { code: 'FORBIDDEN' } }) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'not-mine' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ not_enabled: true });
  });
});
