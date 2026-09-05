import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const TEMPLATE = {
  template_id: 'abc',
  template_name: 'daily-audit',
  observation_class: 'audit',
  cadence: { kind: 'daily', time_of_day: '02:00' },
  enabled: true,
  retention_days: 30,
  last_run_at: null,
  created_at: '2026-09-01T00:00:00.000Z',
  scope: {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: [],
    signal_types: [],
    skus: [],
    depth_limit: 1,
    hop_budget: 5,
  },
};

const fetchMock = vi.fn(async () =>
  new Response(JSON.stringify({ template: TEMPLATE }), { status: 200, headers: { 'content-type': 'application/json' } }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplateDetailPage fetch origin (D-62)', () => {
  it('loads the template from the configured portal origin, not the request Host header', async () => {
    const Page = (await import('../page')).default;
    await Page({ params: Promise.resolve({ id: 'abc' }) });
    expectConfiguredOrigin(fetchMock);
  });
});
