import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

// haiCore's route is `PATCH /connections/:connectionId/downgrade` with a
// required body `{ target_state: 'approved' | 'none' }`
// (haiCore apps/core/src/routes/connections.ts, packages/protocol
// connections/connection.ts DowngradeRequestSchema). The client used to send a
// bodiless POST, which haiCore answers 404 — the Partners page's "Downgrade to
// Approved" never worked (haiWeb review 2026-09-04, owner ruling R-2 2026-09-05).
// These pins are at the WIRE: method, path and body as fetch receives them.

function mockFetchOnce(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('HaiwaveClient.downgradeConnection — wire shape', () => {
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient('tok', 'pid-1234');
  });

  it("sends PATCH with target_state 'approved' in the body", async () => {
    const fetchMock = mockFetchOnce({ connection_id: 'c-1', new_state: 'approved' });
    await client.downgradeConnection('c-1', 'approved');
    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(String(rawUrl)).pathname).toBe('/api/v1/connections/c-1/downgrade');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ target_state: 'approved' });
  });
});
