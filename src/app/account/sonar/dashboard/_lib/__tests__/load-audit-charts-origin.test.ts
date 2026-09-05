import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

const fetchMock = vi.fn(async () =>
  new Response(JSON.stringify({ runs: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('loadAuditChartData fetch origin (D-62)', () => {
  it('resolves the BFF origin itself from configuration, never from a caller-supplied request host', async () => {
    const { loadAuditChartData } = await import('../load-audit-charts');
    await loadAuditChartData();
    expectConfiguredOrigin(fetchMock);
  });
});
