import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroProducts, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { LibraryTab } from '../library-tab';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/x',
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

describe('LibraryTab', () => {
  it('lists each product with its source, variants, line count, readiness and a drill-down', () => {
    render(<LibraryTab projectId={VOMERO_IDS.project} initialProducts={vomeroProducts} />);
    const metcon = screen.getByRole('row', { name: /Metcon Iron/ });
    expect(within(metcon).getByText('Agent')).toBeInTheDocument();
    expect(within(metcon).getByText("13 · Men's US")).toBeInTheDocument();
    expect(within(metcon).getByText('2')).toBeInTheDocument();
    expect(within(metcon).getByText('Ready')).toBeInTheDocument();
    expect(within(metcon).getByRole('link', { name: 'Open Metcon Iron' })).toHaveAttribute(
      'href',
      `/sourcing-map/${VOMERO_IDS.project}/products/${VOMERO_IDS.metcon}`,
    );
  });
});
