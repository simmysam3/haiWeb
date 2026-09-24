import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroProject, vomeroProducts, vomeroRunList, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/sourcing-map/x',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));

describe('/sourcing-map/[projectId] page', () => {
  it('loads project, runs and products; shows the breadcrumb and the Runs tab by default', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroRunList })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project }) }));
    expect(fetchBffJson).toHaveBeenCalledWith(`/api/account/sourcing-map/projects/${VOMERO_IDS.project}`);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Projects›Spring 2027');
    expect(screen.getByRole('tab', { name: 'Runs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Open Line A base' })).toBeInTheDocument();
  });

  it('is a 404 when the project is not the caller’s (haiCore 404)', async () => {
    fetchBffJson.mockResolvedValue({ kind: 'error', status: 404, message: '' });
    const { default: Page } = await import('../page');
    await expect(Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
