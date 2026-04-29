import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { cancelAuditRun, getSession, getToken } = vi.hoisted(() => ({
  cancelAuditRun: vi.fn(),
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
    cancelAuditRun,
  }),
}));

import { POST } from '../route';

const RUN_ID = '11111111-1111-1111-1111-111111111111';
const url = `http://localhost/api/account/audit-runs/${RUN_ID}/cancel`;

describe('POST /api/account/audit-runs/[id]/cancel', () => {
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
    const res = await POST(new NextRequest(url, { method: 'POST' }), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(401);
    expect(cancelAuditRun).not.toHaveBeenCalled();
  });

  it('returns 200 with the haiCore body on a happy in-flight cancel', async () => {
    cancelAuditRun.mockResolvedValueOnce({ ok: true, status: 'running' });
    const res = await POST(new NextRequest(url, { method: 'POST' }), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(cancelAuditRun).toHaveBeenCalledWith(RUN_ID);
    expect(await res.json()).toEqual({ ok: true, status: 'running' });
  });

  it('forwards a 4xx body verbatim from haiCore', async () => {
    cancelAuditRun.mockRejectedValueOnce(
      Object.assign(new Error('haiCore 404'), {
        status: 404,
        haiCoreBody: { error: { code: 'RUN_NOT_FOUND', message: 'Audit run not found' } },
      }),
    );
    const res = await POST(new NextRequest(url, { method: 'POST' }), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'RUN_NOT_FOUND', message: 'Audit run not found' },
    });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    cancelAuditRun.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(new NextRequest(url, { method: 'POST' }), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(500);
  });
});
