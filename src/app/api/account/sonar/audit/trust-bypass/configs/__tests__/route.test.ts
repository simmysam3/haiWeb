import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { listTrustBypassConfigs, getSession, getToken } = vi.hoisted(() => ({
  listTrustBypassConfigs: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    listTrustBypassConfigs,
  }),
}));

import { GET } from '../route';

const url = 'http://localhost/api/account/sonar/audit/trust-bypass/configs';

describe('GET /api/account/sonar/audit/trust-bypass/configs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(listTrustBypassConfigs).not.toHaveBeenCalled();
  });

  it('forwards the haiCore configs body verbatim on success', async () => {
    listTrustBypassConfigs.mockResolvedValueOnce({
      configs: [
        {
          config_id: '11111111-1111-1111-1111-111111111111',
          responder_participant_id: 'p-self',
          trust_class: 'trading_pair',
          enabled: true,
          enabled_at: '2026-04-29T12:00:00.000Z',
          enabled_by_user_id: 'u-1',
          trust_bypass_evaluation_rule: null,
        },
      ],
    });
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configs).toHaveLength(1);
    expect(body.configs[0].trust_class).toBe('trading_pair');
  });

  it('forwards a 4xx body verbatim from haiCore', async () => {
    listTrustBypassConfigs.mockRejectedValueOnce(
      Object.assign(new Error('haiCore 403'), {
        status: 403,
        haiCoreBody: { error: { code: 'INSUFFICIENT_SCOPE', message: 'TRUST_BYPASS_READ required' } },
      }),
    );
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: 'INSUFFICIENT_SCOPE', message: 'TRUST_BYPASS_READ required' },
    });
  });
});
