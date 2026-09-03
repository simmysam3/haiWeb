import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  // eslint-disable-next-line no-var
  var __mockClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest, _ctx?: unknown) => {
    const client = globalThis.__mockClient;
    return await handler({ client, request: req, session: {} });
  },
}));

const baseUrl = 'http://localhost:3001/api/account/sonar/watcher/runs';

describe('GET /api/account/sonar/watcher/runs', () => {
  beforeEach(() => {
    globalThis.__mockClient = {
      listWatcherRuns: vi.fn(async () => ({ runs: [] })),
      triggerWatcherRun: vi.fn(),
    };
  });

  it('calls listWatcherRuns with undefined when no query params are present', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest(baseUrl), { params: Promise.resolve({}) });
    expect(globalThis.__mockClient.listWatcherRuns).toHaveBeenCalledWith(undefined);
  });

  it('forwards template_id', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest(`${baseUrl}?template_id=t-1`), { params: Promise.resolve({}) });
    expect(globalThis.__mockClient.listWatcherRuns).toHaveBeenCalledWith({ template_id: 't-1' });
  });

  // v1.85 (2026-09-02): archived runs are excluded server-side by default;
  // ?archived=true opts the caller in to seeing them.
  it('forwards archived=true', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest(`${baseUrl}?archived=true`), { params: Promise.resolve({}) });
    expect(globalThis.__mockClient.listWatcherRuns).toHaveBeenCalledWith({ archived: true });
  });

  it('forwards template_id and archived together', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest(`${baseUrl}?template_id=t-1&archived=true`), { params: Promise.resolve({}) });
    expect(globalThis.__mockClient.listWatcherRuns).toHaveBeenCalledWith({ template_id: 't-1', archived: true });
  });

  it('does not forward archived when the value is not "true"', async () => {
    const { GET } = await import('../route');
    await GET(new NextRequest(`${baseUrl}?archived=false`), { params: Promise.resolve({}) });
    expect(globalThis.__mockClient.listWatcherRuns).toHaveBeenCalledWith(undefined);
  });
});
