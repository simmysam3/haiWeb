import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BilateralCounterpartiesSkusFields } from '../bilateral-counterparties-skus-fields';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BilateralCounterpartiesSkusFields empty state', () => {
  it('uses modality-neutral nomination language (this control is shared by the watcher wizard, not just audit)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ counterparties: [] }),
      })),
    );

    const { container } = render(
      <BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} />,
    );

    // The empty-state still points users at the nomination flow…
    await screen.findByText(/New nomination/i);
    expect(container.textContent).toMatch(/accepted a nomination/i);
    // …but must not call it an "audit" — on the watcher page that is the wrong
    // modality (Sam's report: "it is not an audit because I am on watchers").
    expect(container.textContent).not.toMatch(/audit/i);
  });
});

describe('BilateralCounterpartiesSkusFields — the whole catalog, not the first page (SEC-web-sonar-3-06)', () => {
  it('offers all 700 SKUs of a trading partner whose catalog spans two pages', async () => {
    const all = Array.from({ length: 700 }, (_, i) => ({
      external_product_id: `SKU-${i + 1}`,
      product_name: `Product ${i + 1}`,
      primary_class_slug: null,
    }));
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.pathname === '/api/account/partners') {
        return json([{ id: 'cp-1', company_name: 'Acme Metals', status: 'trading_pair' }]);
      }
      if (url.pathname.endsWith('/catalog/classes')) return json({ classes: [] });
      if (url.pathname.endsWith('/catalog/products')) {
        const page = Number(url.searchParams.get('page'));
        const size = Number(url.searchParams.get('size'));
        return json({ products: all.slice((page - 1) * size, page * size), total: all.length });
      }
      throw new Error(`unexpected fetch ${url.pathname}`);
    }));

    render(<BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} universe="bilateral_connections" />);
    fireEvent.click(await screen.findByRole('button', { name: /Acme Metals/ }));

    expect(await screen.findByText(/0 of 700 SKUs selected/)).toBeInTheDocument();
  });
});
