import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getTrustBypassAffectedCounterparties, getSession, getToken } = vi.hoisted(() => ({
  getTrustBypassAffectedCounterparties: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: () => true }));
vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getTrustBypassAffectedCounterparties }),
}));

import { GET } from '../route';

const url = (cls: string) =>
  `http://localhost/api/account/sonar/audit/trust-bypass/affected-counterparties?trust_class=${cls}`;

describe('GET /api/account/sonar/audit/trust-bypass/affected-counterparties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new NextRequest(url('trading_pair')), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('forwards trust_class to the client and returns the body', async () => {
    getTrustBypassAffectedCounterparties.mockResolvedValueOnce({
      counterparties: [
        {
          counterparty_participant_id: 'p-1',
          counterparty_display_name: 'Acme',
          outstanding_obligation_count: 3,
          explicit_decline_count: 1,
        },
      ],
    });
    const res = await GET(new NextRequest(url('premier_partner')), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(getTrustBypassAffectedCounterparties).toHaveBeenCalledWith('premier_partner');
    const body = await res.json();
    expect(body.counterparties[0].counterparty_display_name).toBe('Acme');
  });

  it('forwards a 400 from haiCore (bad trust_class) verbatim', async () => {
    getTrustBypassAffectedCounterparties.mockRejectedValueOnce(
      Object.assign(new Error('bad'), {
        status: 400,
        haiCoreBody: { error: { code: 'VALIDATION_ERROR', message: 'invalid trust_class' } },
      }),
    );
    const res = await GET(new NextRequest(url('garbage')), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });
});
