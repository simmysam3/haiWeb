import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

// v1.85 (2026-09-02): mirrors the fetch-stub style of haiwave-api-encoding.test.ts
// and the fetchMock/vi.stubGlobal pattern used by haiwave-api.run-list-filters.test.ts
// and haiwave-api.run-template-methods.test.ts. Those files don't literally export
// jsonResponse/lastUrl/lastInit helpers, so they're defined locally here, thin
// wrappers over the same fetchMock.mock.calls[0] inspection those files use inline.
function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('haiwave-api run disposition (3.80.0)', () => {
  const fetchMock = vi.fn();
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    client = createHaiwaveClient('fake.token.value', '00000000-0000-0000-0000-000000000001');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastUrl(): string {
    return String(fetchMock.mock.calls.at(-1)?.[0]);
  }

  function lastInit(): RequestInit {
    return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
  }

  it('deleteRunTemplate sends ?runs= and returns the disposition body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { deleted: true, runs: { disposition: 'archive', affected: 3 } }),
    );
    const res = await client.deleteRunTemplate('t-1', { runs: 'archive' });
    expect(lastUrl()).toMatch(/\/sonar\/templates\/t-1\?runs=archive$/);
    expect(lastInit().method).toBe('DELETE');
    expect(res).toEqual({ deleted: true, runs: { disposition: 'archive', affected: 3 } });
  });

  it('deleteRunTemplate without opts sends no query string', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { deleted: true, runs: { disposition: 'keep', affected: 0 } }),
    );
    await client.deleteRunTemplate('t-1');
    expect(lastUrl()).toMatch(/\/sonar\/templates\/t-1$/);
  });

  it('listWatcherRuns forwards archived=true and still filters template_id client-side', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        runs: [
          { run_id: 'a', template_id: 't-1' },
          { run_id: 'b', template_id: 't-2' },
        ],
      }),
    );
    const res = await client.listWatcherRuns({ archived: true, template_id: 't-1' });
    expect(lastUrl()).toMatch(/\/sonar\/watcher\/runs\?archived=true$/);
    expect(res.runs.map((r) => r.run_id)).toEqual(['a']);
  });

  it('listAuditRuns forwards archived=true alongside status/limit', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { runs: [] }));
    await client.listAuditRuns({ status: 'complete', limit: 5, archived: true });
    expect(lastUrl()).toMatch(/\/source-audit\/runs\?status=complete&limit=5&archived=true$/);
  });

  it('listWatcherRuns with archived=false sends no archived param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { runs: [] }));
    await client.listWatcherRuns({ template_id: 't-1', archived: false });
    expect(lastUrl()).toMatch(/\/sonar\/watcher\/runs$/);
    expect(lastUrl()).not.toContain('archived');
  });

  it('listAuditRuns with archived omitted sends no archived param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { runs: [] }));
    await client.listAuditRuns({ status: 'complete' });
    expect(lastUrl()).toMatch(/\/source-audit\/runs\?status=complete$/);
    expect(lastUrl()).not.toContain('archived');
  });
});
