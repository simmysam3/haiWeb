import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getGroundedForecastBomSeed } = vi.hoisted(() => ({
  getGroundedForecastBomSeed: vi.fn(),
}));

// Params-forwarding stub (see the list-route test for why).
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore:
    (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, options?: { params?: Promise<unknown> }) =>
      handler({
        client: { getGroundedForecastBomSeed },
        request,
        params: (await options?.params) ?? {},
      }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const base = 'http://localhost/api/account/sonar/grounded-forecasts/bom-seed';

describe('GET /api/account/sonar/grounded-forecasts/bom-seed', () => {
  it('forwards the sku and returns the lines envelope', async () => {
    const lines = [
      { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
    ];
    getGroundedForecastBomSeed.mockResolvedValueOnce({ lines });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(`${base}?sku=A1000-BLK`), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(getGroundedForecastBomSeed).toHaveBeenCalledWith('A1000-BLK');
    expect(await res.json()).toEqual({ lines });
  });

  it('returns 400 VALIDATION_ERROR when sku is missing', async () => {
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(base), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(getGroundedForecastBomSeed).not.toHaveBeenCalled();
  });

  it('returns 400 when sku is present but empty', async () => {
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(`${base}?sku=`), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(getGroundedForecastBomSeed).not.toHaveBeenCalled();
  });
});
