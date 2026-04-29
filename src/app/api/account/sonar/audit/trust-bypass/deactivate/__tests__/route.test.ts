import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { deactivateTrustBypass, getSession, getToken } = vi.hoisted(() => ({
  deactivateTrustBypass: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: () => true }));
vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ deactivateTrustBypass }),
}));

import { POST } from '../route';

const url = 'http://localhost/api/account/sonar/audit/trust-bypass/deactivate';

const buildReq = (body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/account/sonar/audit/trust-bypass/deactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(buildReq({ trust_class: 'trading_pair' }), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(deactivateTrustBypass).not.toHaveBeenCalled();
  });

  it('forwards body and surfaces haiCore 204 to the browser', async () => {
    deactivateTrustBypass.mockResolvedValueOnce(undefined);
    const res = await POST(buildReq({ trust_class: 'premier_partner' }), { params: Promise.resolve({}) });
    expect(res.status).toBe(204);
    expect(deactivateTrustBypass).toHaveBeenCalledWith({ trust_class: 'premier_partner' });
  });

  it('forwards a 4xx body verbatim from haiCore', async () => {
    deactivateTrustBypass.mockRejectedValueOnce(
      Object.assign(new Error('bad'), {
        status: 404,
        haiCoreBody: { error: { code: 'CONFIG_NOT_FOUND', message: 'No config to deactivate' } },
      }),
    );
    const res = await POST(buildReq({ trust_class: 'trading_pair' }), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });
});
