import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManifestsTab } from '../manifests-tab.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('<ManifestsTab>', () => {
  it('renders empty-state message when total_skus = 0', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          json({ total_skus: 0, includes_unclassified: false, classes: [] }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ManifestsTab />);
    await waitFor(() =>
      expect(screen.getByText(/no products registered/i)).toBeInTheDocument(),
    );
  });

  it('renders classes + SKUs in small tier with auto-expand', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          json({
            total_skus: 2,
            includes_unclassified: false,
            classes: [
              { class_id: '1', class_slug: 'widgets', class_name: 'Widgets', sku_count: 2 },
            ],
          }),
        );
      }
      if (url.includes('/grouped/widgets')) {
        return Promise.resolve(
          json({
            skus: [
              {
                origin_manifest_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                external_product_id: 'W1',
                product_name: 'Alpha',
                manifest_version: 1,
                provenance_depth: 'facility',
                updated_at: '2026-05-23T00:00:00.000Z',
              },
              {
                origin_manifest_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                external_product_id: 'W2',
                product_name: 'Beta',
                manifest_version: 1,
                provenance_depth: 'facility',
                updated_at: '2026-05-23T00:00:00.000Z',
              },
            ],
            total: 2,
            page: 1,
            page_size: 200,
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ManifestsTab />);

    // Class label renders once /grouped resolves
    await waitFor(() => expect(screen.getByText('Widgets')).toBeInTheDocument());
    // SKU labels render after auto-expand seeds expanded set + per-class fetch resolves
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('W1')).toBeInTheDocument();
    expect(screen.getByText('W2')).toBeInTheDocument();
  });

  it('switches to flat search view when query >= 2 chars', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          json({
            total_skus: 1,
            includes_unclassified: false,
            classes: [{ class_id: '1', class_slug: 'a', class_name: 'A', sku_count: 1 }],
          }),
        );
      }
      if (url.startsWith('/api/account/provenance/grouped/')) {
        return Promise.resolve(json({ skus: [], total: 0, page: 1, page_size: 200 }));
      }
      if (url.startsWith('/api/account/provenance/search')) {
        return Promise.resolve(
          json({
            matches: [
              {
                origin_manifest_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                external_product_id: 'X-1',
                product_name: 'Found',
                manifest_version: 1,
                provenance_depth: 'facility',
                updated_at: '2026-05-23T00:00:00.000Z',
                class_slugs: ['a'],
              },
            ],
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ManifestsTab />);
    // Wait for the grouped fetch + class render
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());

    // Type into the search box
    const searchInput = screen.getByLabelText('Search products');
    fireEvent.change(searchInput, { target: { value: 'fo' } });

    // The 250ms debounce + async fetch combine to delay the match render.
    // Give it up to 1500ms to be safe across slow CI.
    await waitFor(() => expect(screen.getByText('Found')).toBeInTheDocument(), {
      timeout: 1500,
    });
  });
});
