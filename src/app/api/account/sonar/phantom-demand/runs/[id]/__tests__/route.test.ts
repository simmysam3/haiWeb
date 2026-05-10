import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getPhantomDemandRun,
  getPhantomDemandRunStatus,
  cancelPhantomDemandRun,
  getSession,
  getToken,
} = vi.hoisted(() => ({
  getPhantomDemandRun: vi.fn(),
  getPhantomDemandRunStatus: vi.fn(),
  cancelPhantomDemandRun: vi.fn(),
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
    getPhantomDemandRun,
    getPhantomDemandRunStatus,
    cancelPhantomDemandRun,
  }),
}));

import { GET as getRun } from '../route';
import { GET as getStatus } from '../status/route';
import { POST as postCancel } from '../cancel/route';

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const detailUrl = `http://localhost/api/account/sonar/phantom-demand/runs/${RUN_ID}`;
const statusUrl = `http://localhost/api/account/sonar/phantom-demand/runs/${RUN_ID}/status`;
const cancelUrl = `http://localhost/api/account/sonar/phantom-demand/runs/${RUN_ID}/cancel`;

describe('PD run BFF routes ([id], [id]/status, [id]/cancel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  describe('GET /runs/[id]', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(401);
      expect(getPhantomDemandRun).not.toHaveBeenCalled();
    });

    it('returns the run detail + results envelope from the client', async () => {
      const payload = {
        run_id: RUN_ID,
        status: 'complete',
        results: [{ result_id: 'res-1', sku_id: 'sku-1' }],
      };
      getPhantomDemandRun.mockResolvedValueOnce(payload);
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getPhantomDemandRun).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual(payload);
    });

    it('forwards a 404 verbatim from haiCore', async () => {
      getPhantomDemandRun.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 404'), {
          status: 404,
          haiCoreBody: { error: { code: 'RUN_NOT_FOUND', message: 'Run not found' } },
        }),
      );
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: { code: 'RUN_NOT_FOUND', message: 'Run not found' },
      });
    });
  });

  describe('GET /runs/[id]/status', () => {
    it('returns the lightweight status payload', async () => {
      getPhantomDemandRunStatus.mockResolvedValueOnce({
        status: 'running',
        cancel_requested_at: null,
      });
      const res = await getStatus(new NextRequest(statusUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getPhantomDemandRunStatus).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual({ status: 'running', cancel_requested_at: null });
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await getStatus(new NextRequest(statusUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /runs/[id]/cancel', () => {
    it('returns 200 with ok:true on successful cancel', async () => {
      cancelPhantomDemandRun.mockResolvedValueOnce({ ok: true });
      const res = await postCancel(
        new NextRequest(cancelUrl, { method: 'POST' }),
        { params: Promise.resolve({ id: RUN_ID }) },
      );
      expect(res.status).toBe(200);
      expect(cancelPhantomDemandRun).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await postCancel(
        new NextRequest(cancelUrl, { method: 'POST' }),
        { params: Promise.resolve({ id: RUN_ID }) },
      );
      expect(res.status).toBe(401);
      expect(cancelPhantomDemandRun).not.toHaveBeenCalled();
    });
  });
});
