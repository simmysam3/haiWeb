import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroProject } from '@/lib/sourcing-map/__fixtures__/vomero';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/sourcing-map',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));
// next/link renders an <a> in tests (the house idiom, src/components/__tests__/account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('/sourcing-map page', () => {
  it('loads the projects through the BFF and renders the header crumb and the grid', async () => {
    fetchBffJson.mockResolvedValueOnce({ kind: 'ok', data: { projects: [vomeroProject] } });
    const { default: Page } = await import('../page');
    render(await Page());
    expect(fetchBffJson).toHaveBeenCalledWith('/api/account/sourcing-map/projects');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Projects');
    expect(screen.getByRole('listitem', { name: 'Spring 2027' })).toBeInTheDocument();
  });
});
