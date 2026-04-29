import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getDownstreamGaps, getSession, getToken } = vi.hoisted(() => ({
  getDownstreamGaps: vi.fn(),
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
    getDownstreamGaps,
  }),
}));

import { GET } from '../downstream-gaps/route';

describe('GET /api/account/sku-obligations/downstream-gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
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
    expect(getDownstreamGaps).toHaveBeenCalled();
    expect(await res.json()).toEqual(entries);
  });

  it('forwards resolution_class and on_network_status filters', async () => {
    getDownstreamGaps.mockResolvedValue([]);
    const res = await GET(
      new NextRequest(
        'http://localhost/api/account/sku-obligations/downstream-gaps?resolution_class=pending&resolution_class=agentic_eligible&on_network_status=invited',
      ),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(getDownstreamGaps).toHaveBeenCalledWith({
      resolution_class: ['pending', 'agentic_eligible'],
      on_network_status: ['invited'],
      min_request_count: undefined,
    });
  });

  it('parses min_request_count as integer', async () => {
    getDownstreamGaps.mockResolvedValue([]);
    const res = await GET(
      new NextRequest(
        'http://localhost/api/account/sku-obligations/downstream-gaps?min_request_count=3',
      ),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(getDownstreamGaps).toHaveBeenCalledWith({
      resolution_class: undefined,
      on_network_status: undefined,
      min_request_count: 3,
    });
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
