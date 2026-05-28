import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';
import type { ProvenanceKeyCreationRequest } from '@haiwave/protocol';

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

describe('HaiwaveClient provenance-key methods', () => {
  const token = 'tok';
  const participantId = 'pid-1234';
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient(token, participantId);
  });

  it('listGeneratedKeys GETs /provenance-keys/generated with auth headers', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listGeneratedKeys();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/provenance-keys\/generated$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(init.headers['x-haiwave-participant-id']).toBe(participantId);
  });

  it('generateKey POSTs to /provenance-keys/ with the body', async () => {
    const body: ProvenanceKeyCreationRequest = { friendly_name: 'K', required_fields: ['state_province'], requested_fields: [] };
    const fetchMock = mockFetchOnce({ key: { key_id: 'k1' }, key_value: 'abc' }, 201);
    const res = await client.generateKey(body);
    expect(res.key.key_id).toBe('k1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('updateKey PATCHes /provenance-keys/:keyId', async () => {
    const fetchMock = mockFetchOnce({ key_id: 'k1', friendly_name: 'New' });
    await client.updateKey('k1', { friendly_name: 'New' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/k1$/);
    expect(init.method).toBe('PATCH');
  });

  it('revokeKey DELETEs /provenance-keys/:keyId', async () => {
    const fetchMock = mockFetchOnce({ key_id: 'k1', revoked: true });
    await client.revokeKey('k1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/k1$/);
    expect(init.method).toBe('DELETE');
  });

  it('revealKeyValue GETs /provenance-keys/:keyId/value', async () => {
    const fetchMock = mockFetchOnce({ key_value: 'abc' });
    const res = await client.revealKeyValue('k1');
    expect(res.key_value).toBe('abc');
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/k1\/value$/);
  });

  it('listInstallationsForKey GETs /provenance-keys/:keyId/installations', async () => {
    const fetchMock = mockFetchOnce({ installations: [] });
    const res = await client.listInstallationsForKey('k1');
    expect(res.installations).toEqual([]);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/k1\/installations$/);
  });

  it('previewInstallation POSTs /provenance-keys/installations/preview', async () => {
    const fetchMock = mockFetchOnce({ key_id: 'k1' });
    await client.previewInstallation({ key_hash: 'h' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/installations\/preview$/);
    expect(init.method).toBe('POST');
  });

  it('installKey POSTs /provenance-keys/installations', async () => {
    const fetchMock = mockFetchOnce({ installation_id: 'i1' });
    await client.installKey({ key_hash: 'h', accepted_requested_fields: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/installations$/);
    expect(init.method).toBe('POST');
  });

  it('listMyInstallations GETs /provenance-keys/installations (no includeRemoved)', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listMyInstallations();
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/installations$/);
  });

  it('listMyInstallations appends include_removed=true when requested', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listMyInstallations(true);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('include_removed=true');
  });

  it('updateInstallation PATCHes /provenance-keys/installations/:id', async () => {
    const fetchMock = mockFetchOnce({ installation_id: 'i1' });
    await client.updateInstallation('i1', { accepted_requested_fields: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/installations\/i1$/);
    expect(init.method).toBe('PATCH');
  });

  it('removeInstallation DELETEs /provenance-keys/installations/:id', async () => {
    const fetchMock = mockFetchOnce({ installation_id: 'i1', removed_at: 'now' });
    await client.removeInstallation('i1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/provenance-keys\/installations\/i1$/);
    expect(init.method).toBe('DELETE');
  });

  it('getSharingPolicy GETs /sharing-policy/', async () => {
    const fetchMock = mockFetchOnce({ shared_fields: [] });
    await client.getSharingPolicy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sharing-policy\/$/);
    expect(init.method).toBe('GET');
  });

  it('upsertSharingPolicy PUTs /sharing-policy/ with body', async () => {
    const fetchMock = mockFetchOnce({ policy: { shared_fields: [] }, warnings: [] });
    await client.upsertSharingPolicy({ shared_fields: ['state_province'], dry_run: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sharing-policy\/$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ shared_fields: ['state_province'], dry_run: true });
  });
});

describe('HaiwaveClient PD methods (v1.30)', () => {
  const token = 'tok';
  const participantId = 'pid-1234';
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient(token, participantId);
  });

  it('listPhantomDemandRuns GETs /sonar/phantom-demand/runs', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listPhantomDemandRuns({});
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/phantom-demand\/runs$/);
    expect(init.method).toBe('GET');
  });

  it('listPhantomDemandRuns appends template_id and limit when provided', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listPhantomDemandRuns({ template_id: 'tid-1', limit: 25 });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('template_id=tid-1');
    expect(String(url)).toContain('limit=25');
  });

  it('getPhantomDemandRun GETs /sonar/phantom-demand/runs/:runId and returns {run, tree}', async () => {
    const payload = { run: { run_id: 'r1' }, tree: null };
    const fetchMock = mockFetchOnce(payload);
    const res = await client.getPhantomDemandRun('r1');
    expect(res.run.run_id).toBe('r1');
    expect(res.tree).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/phantom-demand\/runs\/r1$/);
    expect(init.method).toBe('GET');
  });

  it('getPhantomDemandRunStatus GETs /sonar/phantom-demand/runs/:runId/status', async () => {
    const fetchMock = mockFetchOnce({ status: 'running', cancel_requested_at: null });
    const res = await client.getPhantomDemandRunStatus('r1');
    expect(res.status).toBe('running');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/phantom-demand\/runs\/r1\/status$/);
    expect(init.method).toBe('GET');
  });

  it('cancelPhantomDemandRun POSTs to /sonar/phantom-demand/runs/:runId/cancel', async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    await client.cancelPhantomDemandRun('r1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/phantom-demand\/runs\/r1\/cancel$/);
    expect(init.method).toBe('POST');
  });

  it('triggerPhantomDemand POSTs to /sonar/phantom-demand/runs and maps run_id -> runId', async () => {
    const fetchMock = mockFetchOnce({ run_id: 'new-run-123' });
    const body = { template_id: 'tmpl-1', qty_override: 100, target_date_override: null };
    const res = await client.triggerPhantomDemand(body);
    expect(res.runId).toBe('new-run-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/sonar\/phantom-demand\/runs$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('listPhantomDemandTemplates GETs /sonar/templates with observation_class=phantom_demand', async () => {
    const fetchMock = mockFetchOnce([]);
    await client.listPhantomDemandTemplates({ enabled: true, limit: 10 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sonar/templates');
    expect(String(url)).toContain('observation_class=phantom_demand');
    expect(String(url)).toContain('enabled=true');
    expect(String(url)).toContain('limit=10');
    expect(init.method).toBe('GET');
  });

  it('getAgentConfig GETs /agents/:agentId/config', async () => {
    const payload = { agent_id: 'ag-1', sku_picker_scope: 'published_only', mes_enabled: false, mes_config: null };
    const fetchMock = mockFetchOnce(payload);
    const res = await client.getAgentConfig('ag-1');
    expect(res.agent_id).toBe('ag-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/agents\/ag-1\/config$/);
    expect(init.method).toBe('GET');
  });

  it('patchAgentConfig PATCHes to /agents/:agentId/config with patch body', async () => {
    const payload = { agent_id: 'ag-1', sku_picker_scope: 'full_catalog', mes_enabled: false, mes_config: null };
    const fetchMock = mockFetchOnce(payload);
    const res = await client.patchAgentConfig('ag-1', { sku_picker_scope: 'full_catalog' });
    expect(res.sku_picker_scope).toBe('full_catalog');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/agents\/ag-1\/config$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ sku_picker_scope: 'full_catalog' });
  });
});
