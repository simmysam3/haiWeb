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

    it('returns the {run, tree} envelope from the client when tree is present', async () => {
      const NOW = '2026-05-28T00:00:00.000Z';
      const payload = {
        run: {
          run_id: RUN_ID,
          initiator_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          template_id: null,
          run_origin: 'ad_hoc',
          authorization_basis: 'bilateral',
          status: 'complete',
          scope_snapshot: {},
          hop_budget: 3,
          hops_consumed: 2,
          throttled_at: null,
          first_throttle_notified_at: null,
          resumption_count: 0,
          last_position: null,
          cancel_requested_at: null,
          cancelled_at: null,
          started_at: NOW,
          completed_at: NOW,
          triggered_by_user_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
        tree: {
          line_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          component_sku: 'HC-9000',
          component_label: 'Main Assembly',
          qty_per_parent_unit: 1,
          qty_required_total: 10,
          source: 'vendor_stock',
          on_hand_qty: 50,
          vendor_block: null,
          internal_block: null,
          wall_block: null,
          subcomponents: [],
        },
      };
      getPhantomDemandRun.mockResolvedValueOnce(payload);
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getPhantomDemandRun).toHaveBeenCalledWith(RUN_ID);
      const body = await res.json();
      expect(body.run.run_id).toBe(RUN_ID);
      expect(body.tree.component_sku).toBe('HC-9000');
      expect(body).toEqual(payload);
    });

    it('passes tree: null through for queued/running runs', async () => {
      const NOW = '2026-05-28T00:00:00.000Z';
      const payload = {
        run: {
          run_id: RUN_ID,
          initiator_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          template_id: null,
          run_origin: 'ad_hoc',
          authorization_basis: 'bilateral',
          status: 'running',
          scope_snapshot: {},
          hop_budget: 3,
          hops_consumed: 0,
          throttled_at: null,
          first_throttle_notified_at: null,
          resumption_count: 0,
          last_position: null,
          cancel_requested_at: null,
          cancelled_at: null,
          started_at: NOW,
          completed_at: null,
          triggered_by_user_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
        tree: null,
      };
      getPhantomDemandRun.mockResolvedValueOnce(payload);
      const res = await getRun(new NextRequest(detailUrl), {
        params: Promise.resolve({ id: RUN_ID }),
      });
      expect(res.status).toBe(200);
      expect(getPhantomDemandRun).toHaveBeenCalledWith(RUN_ID);
      const body = await res.json();
      expect(body.run.status).toBe('running');
      expect(body.tree).toBeNull();
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
