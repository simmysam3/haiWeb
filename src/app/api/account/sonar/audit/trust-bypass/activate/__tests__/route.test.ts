import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { activateTrustBypass, getSession, getToken } = vi.hoisted(() => ({
  activateTrustBypass: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: () => true }));
vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ activateTrustBypass }),
}));

import { POST } from '../route';

const url = 'http://localhost/api/account/sonar/audit/trust-bypass/activate';

const buildReq = (body: unknown) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/account/sonar/audit/trust-bypass/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(buildReq({ trust_class: 'trading_pair' }), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(activateTrustBypass).not.toHaveBeenCalled();
  });

  it('forwards body to haiCore and returns success body', async () => {
    activateTrustBypass.mockResolvedValueOnce({
      config: {
        config_id: '11111111-1111-1111-1111-111111111111',
        trust_class: 'trading_pair',
        enabled: true,
        enabled_at: '2026-04-29T12:00:00.000Z',
      },
      dissolution: null,
    });
    const res = await POST(
      buildReq({
        trust_class: 'trading_pair',
        activation_mode: 'forward_only',
        retroactive_acknowledgement: false,
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(activateTrustBypass).toHaveBeenCalledWith({
      trust_class: 'trading_pair',
      activation_mode: 'forward_only',
      retroactive_acknowledgement: false,
    });
    const body = await res.json();
    expect(body.config.enabled).toBe(true);
  });

  it('forwards a 400 from haiCore verbatim (retroactive without ack)', async () => {
    activateTrustBypass.mockRejectedValueOnce(
      Object.assign(new Error('bad'), {
        status: 400,
        haiCoreBody: { error: { code: 'VALIDATION_ERROR', message: 'retroactive_acknowledgement must be true' } },
      }),
    );
    const res = await POST(
      buildReq({
        trust_class: 'trading_pair',
        activation_mode: 'retroactive',
        retroactive_acknowledgement: false,
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
  });
});
