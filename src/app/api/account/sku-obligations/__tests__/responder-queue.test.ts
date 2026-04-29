import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let getResponderQueue = vi.fn();
let getSession = vi.fn();
let getToken = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
  getToken: (...args: unknown[]) => getToken(...args),
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getResponderQueue }),
}));

import { GET } from '../responder-queue/route';

describe('GET /api/account/sku-obligations/responder-queue', () => {
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
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/responder-queue'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(401);
  });

  it('forwards status and observer_id filters', async () => {
    getResponderQueue.mockResolvedValue([]);
    const res = await GET(
      new NextRequest(
        'http://localhost/api/account/sku-obligations/responder-queue?status=outstanding&status=acknowledged&observer_id=p-1',
      ),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(getResponderQueue).toHaveBeenCalledWith({
      status: ['outstanding', 'acknowledged'],
      observer_id: ['p-1'],
      product_class: undefined,
    });
  });

  it('returns the grouped payload from the client', async () => {
    const groups = [
      { product_id: 'p1', sku_label: 'A', request_count: 1, earliest_arrival: 't', status_mix: {}, observers: [] },
    ];
    getResponderQueue.mockResolvedValue(groups);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/responder-queue'),
      { params: Promise.resolve({}) },
    );
    expect(await res.json()).toEqual(groups);
  });

  it('propagates 4xx body verbatim from haiCore', async () => {
    const haiCoreErr = Object.assign(new Error('haiCore 403'), {
      status: 403,
      haiCoreBody: { error: { code: 'NO_VENDOR_ACCESS', message: 'forbidden' } },
    });
    getResponderQueue.mockRejectedValueOnce(haiCoreErr);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/responder-queue'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'NO_VENDOR_ACCESS', message: 'forbidden' } });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    getResponderQueue.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/responder-queue'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(500);
  });
});
