import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { listPhantomDemandRuns, triggerPhantomDemand, getSession, getToken } = vi.hoisted(() => ({
  listPhantomDemandRuns: vi.fn(),
  triggerPhantomDemand: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ listPhantomDemandRuns, triggerPhantomDemand }),
}));

import { GET, POST } from '../route';

const listUrl = 'http://localhost/api/account/sonar/phantom-demand/runs';

describe('PD runs BFF routes (list + trigger)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  describe('GET /runs', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await GET(new NextRequest(listUrl), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(listPhantomDemandRuns).not.toHaveBeenCalled();
    });

    it('returns the list of runs from the client', async () => {
      const runs = [{ run_id: 'r1', status: 'complete' }];
      listPhantomDemandRuns.mockResolvedValueOnce(runs);
      const res = await GET(new NextRequest(listUrl), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(runs);
    });

    it('passes template_id and limit query params to client', async () => {
      listPhantomDemandRuns.mockResolvedValueOnce([]);
      const url = `${listUrl}?template_id=tid-1&limit=10`;
      const res = await GET(new NextRequest(url), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      expect(listPhantomDemandRuns).toHaveBeenCalledWith({
        template_id: 'tid-1',
        limit: 10,
      });
    });

    it('forwards a 404 verbatim from haiCore', async () => {
      listPhantomDemandRuns.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 404'), {
          status: 404,
          haiCoreBody: { error: { code: 'NOT_FOUND', message: 'Not found' } },
        }),
      );
      const res = await GET(new NextRequest(listUrl), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
  });

  describe('POST /runs', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify({ scope: {} }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
      expect(triggerPhantomDemand).not.toHaveBeenCalled();
    });

    it('returns 202 with runId on successful trigger', async () => {
      triggerPhantomDemand.mockResolvedValueOnce({ runId: 'new-run-1' });
      const body = {
        scope: {
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: 'cp1',
          skus: ['s1'],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        },
        template_id: null,
      };
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ runId: 'new-run-1' });
      expect(triggerPhantomDemand).toHaveBeenCalledWith(body);
    });
  });
});
