import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const listReports = vi.fn();

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) => async (request: NextRequest) => {
    const client = { listReports };
    return handler({ client, request, session: { user: { id: 'u-1' } }, params: {} });
  },
}));

beforeEach(() => {
  listReports.mockReset();
});

describe('GET /api/account/sonar/reports', () => {
  it('returns 400 when tab querystring is missing', async () => {
    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost/api/account/sonar/reports'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it('forwards tab to HaiwaveClient.listReports', async () => {
    listReports.mockResolvedValue({ reports: [] });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest('http://localhost/api/account/sonar/reports?tab=audit'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reports: [] });
    expect(listReports).toHaveBeenCalledWith({
      tab: 'audit',
      status: undefined,
      date_from: undefined,
      date_to: undefined,
    });
  });

  it('forwards status, date_from, date_to querystrings (review #20 I2)', async () => {
    listReports.mockResolvedValue({ reports: [] });
    const { GET } = await import('../route');
    const url =
      'http://localhost/api/account/sonar/reports?tab=watcher&status=complete' +
      '&date_from=2026-05-01T00:00:00.000Z&date_to=2026-05-11T23:59:59.999Z';
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(listReports).toHaveBeenCalledWith({
      tab: 'watcher',
      status: 'complete',
      date_from: '2026-05-01T00:00:00.000Z',
      date_to: '2026-05-11T23:59:59.999Z',
    });
  });
});
