import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getAuditRunStatus, getSession, getToken } = vi.hoisted(() => ({
  getAuditRunStatus: vi.fn(),
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
    getAuditRunStatus,
  }),
}));

import { GET } from '../route';

const RUN_ID = '22222222-2222-2222-2222-222222222222';
const url = `http://localhost/api/account/audit-runs/${RUN_ID}/status`;

describe('GET /api/account/audit-runs/[id]/status', () => {
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
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(401);
    expect(getAuditRunStatus).not.toHaveBeenCalled();
  });

  it('returns the lightweight status payload from the client', async () => {
    const payload = {
      status: 'running',
      hop_count: 17,
      gap_count: 2,
      results_available_count: 3,
    };
    getAuditRunStatus.mockResolvedValueOnce(payload);
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(getAuditRunStatus).toHaveBeenCalledWith(RUN_ID);
    expect(await res.json()).toEqual(payload);
  });

  it('forwards a 4xx body verbatim from haiCore', async () => {
    getAuditRunStatus.mockRejectedValueOnce(
      Object.assign(new Error('haiCore 404'), {
        status: 404,
        haiCoreBody: { error: { code: 'RUN_NOT_FOUND', message: 'Audit run not found' } },
      }),
    );
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'RUN_NOT_FOUND', message: 'Audit run not found' },
    });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    getAuditRunStatus.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(500);
  });
});
