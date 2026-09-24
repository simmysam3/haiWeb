import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroProject, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ProjectsGrid } from '../projects-grid';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map',
  useSearchParams: () => new URLSearchParams(),
}));
// next/link renders an <a> in tests (the house idiom, src/components/__tests__/account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

describe('ProjectsGrid', () => {
  it('shows each project card with its run count, last activity and a drill-down, plus "+ New project"', () => {
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    const card = screen.getByRole('listitem', { name: 'Spring 2027' });
    expect(within(card).getByText('1 run · 3 products')).toBeInTheDocument();
    expect(within(card).getByText(/Last activity Sep 23, 2026/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Open Spring 2027' })).toHaveAttribute('href', `/sourcing-map/${VOMERO_IDS.project}`);
    expect(screen.getByRole('button', { name: '+ New project' })).toBeInTheDocument();
  });
});
