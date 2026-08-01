import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getGroundedForecastRunStatus } = vi.hoisted(() => ({
  getGroundedForecastRunStatus: vi.fn(),
}));

// Params-forwarding stub (see the list-route test for why).
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore:
    (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, options?: { params?: Promise<unknown> }) =>
      handler({
        client: { getGroundedForecastRunStatus },
        request,
        params: (await options?.params) ?? {},
      }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const RUN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const url = `http://localhost/api/account/sonar/grounded-forecasts/runs/${RUN_ID}/status`;

describe('GET /api/account/sonar/grounded-forecasts/runs/[run_id]/status', () => {
  it('passes the run_id through and returns the cheap status payload', async () => {
    getGroundedForecastRunStatus.mockResolvedValueOnce({
      status: 'running',
      cancel_requested_at: null,
    });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), {
      params: Promise.resolve({ run_id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(getGroundedForecastRunStatus).toHaveBeenCalledWith(RUN_ID);
    expect(await res.json()).toEqual({ status: 'running', cancel_requested_at: null });
  });
});
