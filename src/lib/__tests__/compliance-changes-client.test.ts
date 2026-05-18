import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

function mockFetchOnce(body: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType },
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('HaiwaveClient compliance-changes methods (v1.34 P4)', () => {
  const token = 'tok';
  const participantId = 'pid-1234';
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient(token, participantId);
  });

  it('listComplianceChanges GETs /sonar/compliance/changes with no filters', async () => {
    const fetchMock = mockFetchOnce({ changes: [], total: 0 });
    await client.listComplianceChanges();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/compliance\/changes$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(init.headers['x-haiwave-participant-id']).toBe(participantId);
  });

  it('listComplianceChanges appends kind params when provided', async () => {
    const fetchMock = mockFetchOnce({ changes: [], total: 0 });
    await client.listComplianceChanges({ kind: ['gap_added'] });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('kind=gap_added');
    expect(String(url)).toMatch(/\/sonar\/compliance\/changes/);
  });

  it('listComplianceChanges appends multiple kind params', async () => {
    const fetchMock = mockFetchOnce({ changes: [], total: 0 });
    await client.listComplianceChanges({ kind: ['gap_added', 'gap_resolved'] });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('kind=gap_added');
    expect(String(url)).toContain('kind=gap_resolved');
  });

  it('listComplianceChanges appends from param when provided', async () => {
    const fetchMock = mockFetchOnce({ changes: [], total: 0 });
    await client.listComplianceChanges({ from: '2026-01-01' });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('from=2026-01-01');
  });

  it('listComplianceChanges appends partner param when provided', async () => {
    const fetchMock = mockFetchOnce({ changes: [], total: 0 });
    await client.listComplianceChanges({ partner: 'cp-abc' });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('partner=cp-abc');
  });

  it('getComplianceChange GETs /sonar/compliance/changes/:id', async () => {
    const fetchMock = mockFetchOnce({ change_id: 'chg-1', change_kind: 'gap_added' });
    const res = await client.getComplianceChange('chg-1');
    expect((res as { change_id: string }).change_id).toBe('chg-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/compliance\/changes\/chg-1$/);
    expect(init.method).toBe('GET');
  });

  it('listComplianceChanges rejects when haiCore returns 500', async () => {
    mockFetchOnce({ error: 'internal' }, 500);
    await expect(client.listComplianceChanges()).rejects.toThrow(/500/);
  });

  it('listComplianceChanges rejects when haiCore returns 404', async () => {
    mockFetchOnce({ error: 'not_found' }, 404);
    await expect(client.listComplianceChanges()).rejects.toThrow(/404/);
  });

  it('getComplianceChange rejects when haiCore returns 500', async () => {
    mockFetchOnce({ error: 'internal' }, 500);
    await expect(client.getComplianceChange('chg-bad')).rejects.toThrow(/500/);
  });

  it('getComplianceChange rejects when haiCore returns 404', async () => {
    mockFetchOnce({ error: 'not_found' }, 404);
    await expect(client.getComplianceChange('chg-missing')).rejects.toThrow(/404/);
  });
});
