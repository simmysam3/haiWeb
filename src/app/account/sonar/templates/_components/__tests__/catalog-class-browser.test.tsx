import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogClassBrowser } from '../catalog-class-browser';

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CatalogClassBrowser — own catalog', () => {
  it('lists classes, lazy-loads products on expand, and selects a sku', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return jsonResponse({
          total_skus: 1,
          includes_unclassified: false,
          classes: [
            { class_id: 'c1', class_slug: 'pcb', class_name: 'Printed Circuit Boards', sku_count: 1 },
          ],
        });
      }
      if (url.startsWith('/api/account/provenance/grouped/pcb')) {
        return jsonResponse({
          skus: [{ external_product_id: 'HC-9000', product_name: 'Hub Controller 9000' }],
          total: 1,
          page: 1,
          page_size: 500,
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const onSelect = vi.fn();
    render(
      <CatalogClassBrowser catalog={{ kind: 'own' }} selectedSku="" onSelect={onSelect} />,
    );

    // Class group appears once the class list loads.
    await screen.findByText('Printed Circuit Boards');
    // Products are not fetched until the class is expanded.
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/grouped/pcb'),
    );

    fireEvent.click(
      screen.getByRole('button', { name: /expand printed circuit boards/i }),
    );

    // Product lazy-loads; clicking it selects the sku.
    const product = await screen.findByText('Hub Controller 9000');
    fireEvent.click(product);
    expect(onSelect).toHaveBeenCalledWith('HC-9000');
  });
});

describe('CatalogClassBrowser — trading partner catalog', () => {
  it('loads the partner classes endpoint for a counterparty source', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/partners/partner-1/catalog/classes')) {
        return jsonResponse({
          classes: [
            { class_id: 'cls-9', class_slug: 'connectors', class_name: 'Connectors', product_count: 3 },
          ],
        });
      }
      return jsonResponse({ products: [], total: 0 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogClassBrowser
        catalog={{ kind: 'counterparty', counterpartyId: 'partner-1' }}
        selectedSku=""
        onSelect={vi.fn()}
      />,
    );

    await screen.findByText('Connectors');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/partners/partner-1/catalog/classes',
    );
  });
});

// R-5b interim (owner ruling 2026-09-05): a class's products are fetched as one
// page of 500 and the rest silently did not exist. Until server-side search
// lands, the browser says how many it holds versus how many it shows.
describe('CatalogClassBrowser — a class larger than the page says so', () => {
  it('names the shown count against the total when haiCore reports more products than the page', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/account/partners/vendor-1/catalog/classes') {
        return jsonResponse({
          classes: [{ class_id: 'k1', class_name: 'Connectors', product_count: 700 }],
        });
      }
      if (url.startsWith('/api/account/partners/vendor-1/catalog/products?class_id=k1')) {
        return jsonResponse({
          products: [
            { external_product_id: 'CN-1', product_name: 'Connector 1' },
            { external_product_id: 'CN-2', product_name: 'Connector 2' },
          ],
          total: 700,
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogClassBrowser
        catalog={{ kind: 'counterparty', counterpartyId: 'vendor-1' }}
        selectedSku=""
        onSelect={vi.fn()}
      />,
    );
    await screen.findByText('Connectors');
    fireEvent.click(screen.getByRole('button', { name: /expand connectors/i }));
    await screen.findByText('Connector 2');
    expect(screen.getByText(/showing the first 2 of 700 products/i)).toBeInTheDocument();
  });

  // Catalog search lane (owner ruling R-5b, 2026-09-05): a class larger than
  // one page is paged — "Load more" fetches the next page and appends it.
  it('loads the next page of a large class on "Load more"', async () => {
    const pages: Record<string, { external_product_id: string; product_name: string }[]> = {
      '1': [{ external_product_id: 'CN-1', product_name: 'Connector 1' }],
      '2': [{ external_product_id: 'CN-2', product_name: 'Connector 2' }],
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/account/partners/vendor-1/catalog/classes') {
        return jsonResponse({ classes: [{ class_id: 'k1', class_name: 'Connectors', product_count: 700 }] });
      }
      if (url.startsWith('/api/account/partners/vendor-1/catalog/products?class_id=k1')) {
        const page = new URL(url, 'http://bff').searchParams.get('page') ?? '1';
        return jsonResponse({ products: pages[page] ?? [], total: 700 });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CatalogClassBrowser
        catalog={{ kind: 'counterparty', counterpartyId: 'vendor-1' }}
        selectedSku=""
        onSelect={vi.fn()}
      />,
    );
    await screen.findByText('Connectors');
    fireEvent.click(screen.getByRole('button', { name: /expand connectors/i }));
    await screen.findByText('Connector 1');
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    await screen.findByText('Connector 2');
    expect(screen.getByText('Connector 1')).toBeInTheDocument();
    expect(screen.getByText(/showing the first 2 of 700 products/i)).toBeInTheDocument();
  });
});
