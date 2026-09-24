import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vomeroRunTemplate, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';

const { fetchBffJson, redirectMock } = vi.hoisted(() => ({
  fetchBffJson: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__NEXT_REDIRECT__:${url}`);
  }),
}));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  fetchBffJson.mockReset();
  redirectMock.mockClear();
});

describe('TemplateDetailPage — sourcing_map (R-10 census H1)', () => {
  it('redirects a sourcing_map template to its Sourcing Map run workspace', async () => {
    fetchBffJson.mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } });
    const Page = (await import('../page')).default;
    await expect(Page({ params: Promise.resolve({ id: VOMERO_IDS.template }) })).rejects.toThrow(
      `__NEXT_REDIRECT__:/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.template}`,
    );
  });
});
