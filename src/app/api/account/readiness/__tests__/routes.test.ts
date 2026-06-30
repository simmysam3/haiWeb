import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  transitionReadinessBacklog,
  goFishQuery,
  getGoFishResult,
  getColorwayReadiness,
  listReadinessBacklog,
  rollupReadiness,
  getSession,
  getToken,
} = vi.hoisted(() => ({
  transitionReadinessBacklog: vi.fn(),
  goFishQuery: vi.fn(),
  getGoFishResult: vi.fn(),
  getColorwayReadiness: vi.fn(),
  listReadinessBacklog: vi.fn(),
  rollupReadiness: vi.fn(),
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
    transitionReadinessBacklog,
    goFishQuery,
    getGoFishResult,
    getColorwayReadiness,
    listReadinessBacklog,
    rollupReadiness,
  }),
}));

// Route handlers imported AFTER mocks are in place.
import { POST as transitionPOST } from '../backlog/[id]/transition/route';
import { POST as goFishPOST } from '../gofish/route';
import { GET as goFishGET } from '../gofish/[query_id]/route';
import { GET as skuRefGET } from '../[sku_ref]/route';
import { GET as backlogGET } from '../backlog/route';
import { GET as rollupGET } from '../rollup/route';

describe('readiness BFF routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-csg' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  describe('POST /api/account/readiness/backlog/[id]/transition', () => {
    it('returns 401 when no session', async () => {
      getSession.mockResolvedValue(null);
      const res = await transitionPOST(
        new NextRequest('http://localhost/api/account/readiness/backlog/b1/transition', {
          method: 'POST',
          body: JSON.stringify({ to_state: 'acknowledged' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'b1' }) },
      );
      expect(res.status).toBe(401);
    });

    it('calls transitionReadinessBacklog with the correct id and body', async () => {
      const stub = {
        backlog_item_id: 'b1',
        state: 'acknowledged',
        created_at: '2026-06-29T00:00:00Z',
        updated_at: '2026-06-29T01:00:00Z',
        audit_ref: null,
        event: { event_type: 'quantity_short' },
      };
      transitionReadinessBacklog.mockResolvedValue(stub);

      const res = await transitionPOST(
        new NextRequest('http://localhost/api/account/readiness/backlog/b1/transition', {
          method: 'POST',
          body: JSON.stringify({ to_state: 'acknowledged' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'b1' }) },
      );

      expect(res.status).toBe(200);
      expect(transitionReadinessBacklog).toHaveBeenCalledWith('b1', { to_state: 'acknowledged' });
      expect(await res.json()).toEqual(stub);
    });

    it('propagates 409 from haiCore verbatim', async () => {
      const err = Object.assign(new Error('haiCore 409'), {
        status: 409,
        haiCoreBody: { error: { code: 'ILLEGAL_TRANSITION' } },
      });
      transitionReadinessBacklog.mockRejectedValueOnce(err);

      const res = await transitionPOST(
        new NextRequest('http://localhost/api/account/readiness/backlog/b1/transition', {
          method: 'POST',
          body: JSON.stringify({ to_state: 'resolved' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'b1' }) },
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: { code: 'ILLEGAL_TRANSITION' } });
    });
  });

  describe('POST /api/account/readiness/gofish', () => {
    it('calls goFishQuery with the request body and returns the query_id', async () => {
      goFishQuery.mockResolvedValue({ query_id: 'q-abc' });

      const body = {
        query_id: 'q-abc',
        query_text: 'TOLU-33 leather 6000 sq_ft',
        max_results: 10,
      };
      const res = await goFishPOST(
        new NextRequest('http://localhost/api/account/readiness/gofish', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );

      expect(res.status).toBe(200);
      expect(goFishQuery).toHaveBeenCalledWith(body);
      expect(await res.json()).toEqual({ query_id: 'q-abc' });
    });
  });

  describe('GET /api/account/readiness/gofish/[query_id]', () => {
    it('calls getGoFishResult with the correct query_id', async () => {
      const stub = {
        query_id: 'q-abc',
        results: [],
        total_responding_vendors: 0,
        total_offerings: 0,
        resolved_at: null,
        query_class_ids: [],
      };
      getGoFishResult.mockResolvedValue(stub);

      const res = await goFishGET(
        new NextRequest('http://localhost/api/account/readiness/gofish/q-abc'),
        { params: Promise.resolve({ query_id: 'q-abc' }) },
      );

      expect(res.status).toBe(200);
      expect(getGoFishResult).toHaveBeenCalledWith('q-abc');
      expect(await res.json()).toEqual(stub);
    });
  });
  describe('GET /api/account/readiness/[sku_ref]', () => {
    it('calls getColorwayReadiness with the correct sku_ref', async () => {
      const stub = {
        sku_ref: 'VOMERO-IRONSTONE',
        colorway_name: 'Ironstone Fade',
        run_qty: 10000,
        rolled_up_state: 'at_risk',
        lines: [],
      };
      getColorwayReadiness.mockResolvedValue(stub);

      const res = await skuRefGET(
        new NextRequest('http://localhost/api/account/readiness/VOMERO-IRONSTONE'),
        { params: Promise.resolve({ sku_ref: 'VOMERO-IRONSTONE' }) },
      );

      expect(res.status).toBe(200);
      expect(getColorwayReadiness).toHaveBeenCalledWith('VOMERO-IRONSTONE', expect.any(Object));
      expect(await res.json()).toEqual(stub);
    });
  });

  describe('GET /api/account/readiness/backlog', () => {
    it('calls listReadinessBacklog with sku_ref from query params', async () => {
      const stub = { items: [] };
      listReadinessBacklog.mockResolvedValue(stub);

      const res = await backlogGET(
        new NextRequest('http://localhost/api/account/readiness/backlog?sku_ref=VOMERO-IRONSTONE'),
        { params: Promise.resolve({}) },
      );

      expect(res.status).toBe(200);
      expect(listReadinessBacklog).toHaveBeenCalledWith(
        expect.objectContaining({ skuRef: 'VOMERO-IRONSTONE' }),
      );
      expect(await res.json()).toEqual(stub);
    });
  });

  describe('GET /api/account/readiness/rollup', () => {
    it('calls rollupReadiness and returns colorways', async () => {
      const stub = {
        colorways: [
          { sku_ref: 'VOMERO-IRONSTONE', colorway_name: 'Ironstone Fade', rolled_up_state: 'at_risk' },
        ],
      };
      rollupReadiness.mockResolvedValue(stub);

      const res = await rollupGET(
        new NextRequest('http://localhost/api/account/readiness/rollup'),
        { params: Promise.resolve({}) },
      );

      expect(res.status).toBe(200);
      expect(rollupReadiness).toHaveBeenCalled();
      expect(await res.json()).toEqual(stub);
    });
  });
});