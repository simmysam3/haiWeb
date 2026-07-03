import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

function mockFetchOnce(body: unknown = { ok: true }, status = 200) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

// Reserved chars (&, /, ?, #, space) that smuggle extra query params or path
// segments into the request if interpolated unencoded. Assertions round-trip
// the captured URL through the URL/URLSearchParams parser rather than
// comparing encoded substrings verbatim — encodeURIComponent (path segments)
// and URLSearchParams (query strings, which use +-for-space form encoding)
// are both correct, just byte-different, so the real property under test is
// "the dirty value survives as one opaque segment/param", not a specific
// percent-encoding scheme.
const DIRTY = 'a&b/c?d#e f';

describe('HaiwaveClient — path/query interpolation encoding', () => {
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient('tok', 'pid-1234');
  });

  it('getPaymentHistory keeps the address as one opaque query value', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.getPaymentHistory(DIRTY, 20, 0);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get('address')).toBe(DIRTY);
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.pathname).toBe('/api/v1/payments/history');
  });

  it('getSellSideOrders keeps status as one opaque query value', async () => {
    const fetchMock = mockFetchOnce({ items: [], total_count: 0 });
    await client.getSellSideOrders(DIRTY);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get('status')).toBe(DIRTY);
    expect(url.pathname).toBe('/api/v1/orders/sell-side');
  });

  it('getPaymentManifest keeps participantId as one opaque path segment and type as one opaque query value', async () => {
    const fetchMock = mockFetchOnce({});
    await client.getPaymentManifest(DIRTY, DIRTY);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.pathname).toBe(`/api/v1/payments/manifests/${encodeURIComponent(DIRTY)}`);
    expect(url.searchParams.get('type')).toBe(DIRTY);
  });

  it('getSpendingPolicy keeps participantId as one opaque path segment', async () => {
    const fetchMock = mockFetchOnce({});
    await client.getSpendingPolicy(DIRTY);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.pathname).toBe(`/api/v1/policies/spending/${encodeURIComponent(DIRTY)}`);
  });

  it('unblockParticipant keeps blocked_participant_id as one opaque query value', async () => {
    const fetchMock = mockFetchOnce({ success: true });
    await client.unblockParticipant(DIRTY);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.searchParams.get('blocked_participant_id')).toBe(DIRTY);
    expect(url.pathname).toBe('/api/v1/connections/block');
  });

  it('deletePricingLevel keeps manifestId as one opaque path segment', async () => {
    const fetchMock = mockFetchOnce({ success: true });
    await client.deletePricingLevel(DIRTY);
    const [rawUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.pathname).toBe(`/api/v1/pricing/level/${encodeURIComponent(DIRTY)}`);
  });
});
