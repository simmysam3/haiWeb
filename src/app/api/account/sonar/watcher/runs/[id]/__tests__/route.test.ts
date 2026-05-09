import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getWatcherRun, cancelWatcherRun, getWatcherRunStatus, getSession, getToken } = vi.hoisted(() => ({
  getWatcherRun: vi.fn(),
  cancelWatcherRun: vi.fn(),
  getWatcherRunStatus: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getWatcherRun, cancelWatcherRun, getWatcherRunStatus }),
}));

import { GET as getRun } from '../route';
import { POST as postCancel } from '../cancel/route';
import { GET as getStatus } from '../status/route';

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const detailUrl = `http://localhost/api/account/sonar/watcher/runs/${RUN_ID}`;
const cancelUrl = `http://localhost/api/account/sonar/watcher/runs/${RUN_ID}/cancel`;
const statusUrl = `http://localhost/api/account/sonar/watcher/runs/${RUN_ID}/status`;

describe('Watcher run BFF routes', () => {
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
      expect(getWatcherRun).not.toHaveBeenCalled();
    });

    it('returns the run + results envelope from the client', async () => {
      const payload = {
        run: { run_id: RUN_ID, status: 'complete' },
        results: [{ result_id: 'r1' }],
      };
      getWatcherRun.mockResolvedValueOnce(payload);
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getWatcherRun).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual(payload);
    });

    it('forwards a 404 verbatim from haiCore (existence-leak idiom)', async () => {
      getWatcherRun.mockRejectedValueOnce(
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

  describe('POST /runs/[id]/cancel', () => {
    it('returns 200 with cancel envelope on a successful cancel', async () => {
      cancelWatcherRun.mockResolvedValueOnce({ cancelled: true });
      const res = await postCancel(new NextRequest(cancelUrl, { method: 'POST' }), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(cancelWatcherRun).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual({ cancelled: true });
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await postCancel(new NextRequest(cancelUrl, { method: 'POST' }), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(401);
      expect(cancelWatcherRun).not.toHaveBeenCalled();
    });
  });

  describe('GET /runs/[id]/status', () => {
    it('returns the lightweight status payload', async () => {
      getWatcherRunStatus.mockResolvedValueOnce({ status: 'running' });
      const res = await getStatus(new NextRequest(statusUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getWatcherRunStatus).toHaveBeenCalledWith(RUN_ID);
      expect(await res.json()).toEqual({ status: 'running' });
    });
  });
});
