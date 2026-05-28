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
