import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroRunList, vomeroRunTemplate, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { RunsTab } from '../runs-tab';

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

describe('RunsTab', () => {
  it('lists each run with products, last execution, portfolio coverage and a status pill', () => {
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    const row = screen.getByRole('row', { name: /Line A base/ });
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('Sep 23, 2026')).toBeInTheDocument();
    expect(within(row).getByText('90%')).toBeInTheDocument();
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Open Line A base' })).toHaveAttribute('href', `/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.template}`);
  });
});
