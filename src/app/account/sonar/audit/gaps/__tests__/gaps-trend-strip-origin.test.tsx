import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

const fetchMock = vi.fn(async () =>
  new Response(
    JSON.stringify({ window_days: 28, current_count: 3, prior_count: null, delta: null, series: [] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('GapsTrendStrip fetch origin (D-62)', () => {
  it('fetches the trend from the configured portal origin, not the request Host header', async () => {
    const { GapsTrendStrip } = await import('../gaps-trend-strip');
    await GapsTrendStrip();
    expectConfiguredOrigin(fetchMock);
  });
});
