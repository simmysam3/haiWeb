import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let getDownstreamGaps: ReturnType<typeof vi.fn>;
let getSession: ReturnType<typeof vi.fn>;
let getToken: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => (getSession as typeof getSession)(...args),
  getToken: (...args: unknown[]) => (getToken as typeof getToken)(...args),
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    getDownstreamGaps: (...args: unknown[]) => (getDownstreamGaps as typeof getDownstreamGaps)(...args),
  }),
}));

import { GET } from '../downstream-gaps/route';

describe('GET /api/account/sku-obligations/downstream-gaps', () => {
  beforeEach(() => {
    getDownstreamGaps = vi.fn();
    getSession = vi.fn().mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken = vi.fn().mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/downstream-gaps'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(401);
  });

  it('returns the entries from the client', async () => {
    const entries = [
      {
        sku_label: 'GASKET-2',
        product_id: 'p2',
        internal_subtier_vendor_id: null,
        internal_subtier_vendor_name: null,
        request_count: 3,
        upstream_observer_ids: ['p-acme'],
        resolution_class: 'pending',
        estimated_resolution_path: 'Awaiting subtier',
        on_network_status: 'invited',
      },
    ];
    getDownstreamGaps.mockResolvedValue(entries);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/downstream-gaps'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(entries);
  });

  it('propagates 4xx body verbatim from haiCore', async () => {
    const haiCoreErr = Object.assign(new Error('haiCore 403'), {
      status: 403,
      haiCoreBody: { error: { code: 'NO_VENDOR_ACCESS', message: 'forbidden' } },
    });
    getDownstreamGaps.mockRejectedValueOnce(haiCoreErr);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/downstream-gaps'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'NO_VENDOR_ACCESS', message: 'forbidden' } });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    getDownstreamGaps.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/downstream-gaps'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(500);
  });
});
