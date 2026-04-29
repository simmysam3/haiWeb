import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getResponderQueue = vi.fn();

const mockClient = {
  getResponderQueue,
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest) => {
      const result = await handler({
        client: mockClient,
        session: { participant: { id: 'p-self' }, user: { role: 'owner' } },
        request,
        params: {},
      });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result);
    },
}));

describe('GET /api/account/sku-obligations/responder-queue', () => {
  beforeEach(() => {
    getResponderQueue.mockReset();
  });

  it('forwards status and observer_id filters', async () => {
    getResponderQueue.mockResolvedValue([]);
    const { GET } = await import('../responder-queue/route');
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
    const { GET } = await import('../responder-queue/route');
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/responder-queue'),
      { params: Promise.resolve({}) },
    );
    expect(await res.json()).toEqual(groups);
  });
});
