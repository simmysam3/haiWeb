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

const validBody = {
  template_id: '00000000-0000-0000-0000-000000000001',
  qty_override: 50,
  target_date_override: '2026-07-01',
};

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
          body: JSON.stringify(validBody),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
      expect(triggerPhantomDemand).not.toHaveBeenCalled();
    });

    it('returns 202 with runId on successful trigger', async () => {
      triggerPhantomDemand.mockResolvedValueOnce({ runId: 'new-run-1' });
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify(validBody),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ runId: 'new-run-1' });
      expect(triggerPhantomDemand).toHaveBeenCalledWith(validBody);
    });

    it('returns 202 when optional overrides are omitted', async () => {
      triggerPhantomDemand.mockResolvedValueOnce({ runId: 'new-run-2' });
      const body = { template_id: '00000000-0000-0000-0000-000000000002' };
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(202);
      expect(triggerPhantomDemand).toHaveBeenCalledWith(body);
    });

    it('returns 202 when optional overrides are explicitly null', async () => {
      triggerPhantomDemand.mockResolvedValueOnce({ runId: 'new-run-3' });
      const body = {
        template_id: '00000000-0000-0000-0000-000000000003',
        qty_override: null,
        target_date_override: null,
      };
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(202);
      expect(triggerPhantomDemand).toHaveBeenCalledWith(body);
    });

    it('returns 400 when template_id is missing', async () => {
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify({ qty_override: 10 }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(triggerPhantomDemand).not.toHaveBeenCalled();
    });

    it('returns 400 when template_id is not a valid UUID', async () => {
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify({ template_id: 'not-a-uuid' }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(triggerPhantomDemand).not.toHaveBeenCalled();
    });

    it('returns 400 when body is not parseable JSON', async () => {
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: 'not-json',
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      expect(triggerPhantomDemand).not.toHaveBeenCalled();
    });

    it('forwards a 422 verbatim from haiCore', async () => {
      triggerPhantomDemand.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 422'), {
          status: 422,
          haiCoreBody: { error: { code: 'PROBE_LIMIT_EXCEEDED', message: 'Too many probes' } },
        }),
      );
      const res = await POST(
        new NextRequest(listUrl, {
          method: 'POST',
          body: JSON.stringify(validBody),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        error: { code: 'PROBE_LIMIT_EXCEEDED', message: 'Too many probes' },
      });
    });
  });
});
