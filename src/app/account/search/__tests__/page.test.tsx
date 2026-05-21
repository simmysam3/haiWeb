import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.37 follow-up #4 — the search page was refactored to use the shared
 * `fetchBffJson` helper (mirrors the dashboard unification). The mocks
 * here track the dashboard test's pattern: `vi.hoisted` + module mock of
 * `@/lib/server-fetch`, returning discriminated `FetchResult<T>` shapes.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () =>
    Promise.resolve(
      new Map([
        ['host', 'localhost:3001'],
        ['x-forwarded-proto', 'http'],
      ]) as unknown as Headers,
    ),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  fetchBffJson.mockReset();
});

describe('GlobalSearchPage — server component', () => {
  it('renders the prompt copy when no q is provided', async () => {
    const { default: Page } = await import('../page');
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(
      screen.getByText(/Search counterparties, SKUs, and audit scopes/),
    ).toBeDefined();
  });

  it('renders the too-short message when q is 1 char', async () => {
    const { default: Page } = await import('../page');
    const ui = await Page({ searchParams: Promise.resolve({ q: 'a' }) });
    render(ui);
    expect(
      screen.getByText(/Type at least 2 characters/),
    ).toBeDefined();
  });

  it('renders three categorized sections for a happy response', async () => {
    fetchBffJson.mockResolvedValueOnce({
      kind: 'ok',
      data: {
        counterparties: [
          {
            participant_id: '11111111-1111-1111-1111-111111111111',
            legal_name: 'Acme Widgets Inc',
            dba_name: null,
            status: 'active',
          },
        ],
        skus: [],
        scopes: [
          {
            scope_id: '44444444-4444-4444-4444-444444444444',
            scope_type: 'product',
            subject: 'rubber-gasket',
            initiator_participant_id: '55555555-5555-5555-5555-555555555555',
            vendor_participant_id: '66666666-6666-6666-6666-666666666666',
            counterparty_legal_name: 'Vendor Co',
            acceptance_status: 'declined',
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
    const { default: Page } = await import('../page');
    const ui = await Page({ searchParams: Promise.resolve({ q: 'acme' }) });
    render(ui);
    expect(screen.getByText('Counterparties')).toBeDefined();
    expect(screen.getByText('SKUs')).toBeDefined();
    expect(screen.getByText('Scopes / Requests')).toBeDefined();
    expect(screen.getByText('Acme Widgets Inc')).toBeDefined();
    expect(screen.getByText('rubber-gasket')).toBeDefined();
  });

  it('shows an "unavailable" message when the BFF returns non-ok', async () => {
    fetchBffJson.mockResolvedValueOnce({
      kind: 'error',
      status: 500,
      message: 'boom',
    });
    // Silence the diagnostic log so the test output stays readable.
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { default: Page } = await import('../page');
    const ui = await Page({ searchParams: Promise.resolve({ q: 'acme' }) });
    render(ui);
    expect(
      screen.getByText(/temporarily unavailable/),
    ).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('shows the empty-state message when all three categories are empty', async () => {
    fetchBffJson.mockResolvedValueOnce({
      kind: 'ok',
      data: { counterparties: [], skus: [], scopes: [] },
    });
    const { default: Page } = await import('../page');
    const ui = await Page({ searchParams: Promise.resolve({ q: 'nothingmatches' }) });
    render(ui);
    expect(screen.getByText(/No results for/)).toBeDefined();
  });

  it('paginates SKUs when total > PAGE_SIZE (25)', async () => {
    const manySkus = Array.from({ length: 30 }, (_, i) => ({
      product_id: `PROD-${i}`,
      sku_label: `Sku Label ${i}`,
      responder_participant_id: '22222222-2222-2222-2222-222222222222',
      responder_legal_name: 'Vendor Co',
      status: 'outstanding',
      obligation_id: `99999999-9999-9999-9999-${String(i).padStart(12, '0')}`,
    }));
    fetchBffJson.mockResolvedValueOnce({
      kind: 'ok',
      data: { counterparties: [], skus: manySkus, scopes: [] },
    });
    const { default: Page } = await import('../page');
    const ui = await Page({
      searchParams: Promise.resolve({ q: 'sku', page_skus: '2' }),
    });
    render(ui);
    // Page 2 should render rows 25–29 (5 rows). The header says "30 results".
    expect(screen.getByText('30 results')).toBeDefined();
    expect(screen.getByText('Sku Label 25')).toBeDefined();
    expect(screen.queryByText('Sku Label 0')).toBeNull();
    expect(screen.getByText(/Page 2 of 2/)).toBeDefined();
  });
});
