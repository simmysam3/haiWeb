import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getRunResumptionState, getSession, getToken } = vi.hoisted(() => ({
  getRunResumptionState: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getRunResumptionState }),
}));

import { GET } from '../resumption-state/route';

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const baseUrl = `http://localhost/api/account/sonar/runs/${RUN_ID}/resumption-state`;

const MOCK_STATE = {
  run_id: RUN_ID,
  observation_class: 'audit',
  position: { vendor_index: 2 },
  resumption_count: 1,
  throttled_at: '2026-05-01T00:30:00.000Z',
  next_resume_at: '2026-05-01T01:30:00.000Z',
  last_resume_at: null,
  last_resume_position_advanced_to: null,
};

describe('GET /api/account/sonar/runs/[id]/resumption-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 without a session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(new NextRequest(baseUrl), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(401);
    expect(getRunResumptionState).not.toHaveBeenCalled();
  });

  it('returns 200 with the resumption state from haiCore', async () => {
    getRunResumptionState.mockResolvedValueOnce(MOCK_STATE);
    const res = await GET(new NextRequest(baseUrl), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(getRunResumptionState).toHaveBeenCalledWith(RUN_ID);
    expect(await res.json()).toEqual(MOCK_STATE);
  });

  it('propagates 404 from haiCore verbatim (run not found)', async () => {
    getRunResumptionState.mockRejectedValueOnce(
      Object.assign(new Error('haiCore 404'), {
        status: 404,
        haiCoreBody: { error: { code: 'RUN_NOT_FOUND', message: 'Run not found' } },
      }),
    );
    const res = await GET(new NextRequest(baseUrl), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'RUN_NOT_FOUND', message: 'Run not found' },
    });
  });

  it('propagates 404 from haiCore verbatim (no resumption state)', async () => {
    getRunResumptionState.mockRejectedValueOnce(
      Object.assign(new Error('haiCore 404'), {
        status: 404,
        haiCoreBody: { error: { code: 'NO_RESUMPTION_STATE', message: 'No resumption state exists' } },
      }),
    );
    const res = await GET(new NextRequest(baseUrl), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NO_RESUMPTION_STATE');
  });

  // NOTE: 5xx haiCore failures are handled by withHaiCore (returns 500 in
  // production, fallback in dev). The canonical pattern used here does not
  // try to override process.env.NODE_ENV — tested end-to-end by with-hai-core
  // unit tests instead.
});
