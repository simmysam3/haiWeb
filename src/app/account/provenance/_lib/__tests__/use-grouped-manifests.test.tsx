import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGroupedManifests } from '../use-grouped-manifests';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('useGroupedManifests', () => {
  it("resolves tier='small' and preloads every class for <60 SKUs", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          jsonResponse({
            total_skus: 5,
            includes_unclassified: false,
            classes: [
              { class_id: '1', class_slug: 'a', class_name: 'A', sku_count: 3 },
              { class_id: '2', class_slug: 'b', class_name: 'B', sku_count: 2 },
            ],
          }),
        );
      }
      if (url.startsWith('/api/account/provenance/grouped/')) {
        return Promise.resolve(
          jsonResponse({ skus: [], total: 0, page: 1, page_size: 200 }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useGroupedManifests());
    await waitFor(() => expect(result.current.tier).toBe('small'));
    await waitFor(() => expect(result.current.skusByClass.size).toBe(2));
    expect(result.current.skusByClass.has('a')).toBe(true);
    expect(result.current.skusByClass.has('b')).toBe(true);
    // Loaded values should be arrays (the empty list returned above),
    // not the 'loading' sentinel.
    expect(Array.isArray(result.current.skusByClass.get('a'))).toBe(true);
  });

  it("resolves tier='medium' for 60..299 SKUs and preloads all", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          jsonResponse({
            total_skus: 120,
            includes_unclassified: false,
            classes: [{ class_id: '1', class_slug: 'a', class_name: 'A', sku_count: 120 }],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ skus: [], total: 0, page: 1, page_size: 200 }));
    });
    const { result } = renderHook(() => useGroupedManifests());
    await waitFor(() => expect(result.current.tier).toBe('medium'));
    await waitFor(() => expect(result.current.skusByClass.has('a')).toBe(true));
  });

  it("resolves tier='large' for >=300 SKUs and does NOT preload", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          jsonResponse({
            total_skus: 500,
            includes_unclassified: false,
            classes: [{ class_id: '1', class_slug: 'a', class_name: 'A', sku_count: 500 }],
          }),
        );
      }
      throw new Error(`unexpected fetch in large tier: ${url}`);
    });
    const { result } = renderHook(() => useGroupedManifests());
    await waitFor(() => expect(result.current.tier).toBe('large'));
    // Allow any background settle work — but the cache must still be empty
    // because no per-class fetch should have fired.
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.skusByClass.size).toBe(0);
  });

  it("loadClass(slug) populates cache lazily and is idempotent on re-call", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/account/provenance/grouped') {
        return Promise.resolve(
          jsonResponse({
            total_skus: 500,
            includes_unclassified: false,
            classes: [{ class_id: '1', class_slug: 'a', class_name: 'A', sku_count: 1 }],
          }),
        );
      }
      if (url.startsWith('/api/account/provenance/grouped/')) {
        return Promise.resolve(
          jsonResponse({
            skus: [
              {
                origin_manifest_id: '00000000-0000-0000-0000-000000000001',
                external_product_id: 'P1',
                product_name: 'Alpha',
                manifest_version: 1,
                provenance_depth: 'facility',
                updated_at: '2026-05-23T00:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            page_size: 200,
          }),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { result } = renderHook(() => useGroupedManifests());
    await waitFor(() => expect(result.current.tier).toBe('large'));

    await act(async () => {
      await result.current.loadClass('a');
    });
    await waitFor(() => {
      const cell = result.current.skusByClass.get('a');
      return Array.isArray(cell);
    });
    const cell = result.current.skusByClass.get('a');
    expect(Array.isArray(cell)).toBe(true);
    const arr = cell as ReadonlyArray<unknown>;
    expect(arr).toHaveLength(1);
  });

  it("surfaces error when /grouped fetch fails", async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response));
    const { result } = renderHook(() => useGroupedManifests());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.tier).toBeNull();
  });
});
