import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getGroundedForecastResult } = vi.hoisted(() => ({
  getGroundedForecastResult: vi.fn(),
}));

// Params-forwarding stub (see the sibling list-route test): this route reads
// `template_id` off the dynamic segment, so a stub that discarded params would
// pass while the route asked haiCore for `undefined`.
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore:
    (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, options?: { params?: Promise<unknown> }) =>
      handler({
        client: { getGroundedForecastResult },
        request,
        params: (await options?.params) ?? {},
      }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const TEMPLATE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const url = `http://localhost/api/account/sonar/grounded-forecasts/${TEMPLATE_ID}/result`;

describe('GET /api/account/sonar/grounded-forecasts/[template_id]/result', () => {
  it('passes the template_id through and returns the result envelope verbatim', async () => {
    const payload = {
      result: {
        generated_at: '2026-07-30T00:00:00.000Z',
        product_name: 'a2000',
        pacer_ranking: ['cpt_sole_compound'],
      },
      run_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      last_run_at: '2026-07-30T00:00:00.000Z',
    };
    getGroundedForecastResult.mockResolvedValueOnce(payload);
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ template_id: TEMPLATE_ID }),
    });
    expect(res.status).toBe(200);
    expect(getGroundedForecastResult).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(await res.json()).toEqual(payload);
  });
});
