import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  var __mockClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest) => {
    const client = globalThis.__mockClient;
    return await handler({ client, request: req, params: {}, session: {} });
  },
}));

import { GET } from '../route';

const FIXTURE = {
  incoming: { day: 12, week: 63, month: 240 },
  responded_today: 9,
  outstanding: 47,
  aging: { under_2d: 28, d2_5: 11, d5_plus: 8 },
  expired_30d: 16,
};

function setMockClient(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  globalThis.__mockClient = {
    getQuoteMetrics: vi.fn().mockResolvedValue(FIXTURE),
    ...overrides,
  };
}

describe('GET /api/account/quote-metrics', () => {
  beforeEach(() => {
    setMockClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards the tz parameter to haiCore', async () => {
    const req = new NextRequest('http://x/api/account/quote-metrics?tz=America/Los_Angeles');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(globalThis.__mockClient.getQuoteMetrics).toHaveBeenCalledWith('America/Los_Angeles');
    expect(await res.json()).toEqual(FIXTURE);
  });

  it('defaults tz to UTC when the parameter is absent', async () => {
    const req = new NextRequest('http://x/api/account/quote-metrics');
    await GET(req, { params: Promise.resolve({}) });

    expect(globalThis.__mockClient.getQuoteMetrics).toHaveBeenCalledWith('UTC');
  });
});
