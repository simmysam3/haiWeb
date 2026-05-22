import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

function mockResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HaiwaveClient run-template methods', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client() {
    return createHaiwaveClient(
      'fake.token.value',
      '00000000-0000-0000-0000-000000000001',
    );
  }

  it('listRunTemplates calls GET /sonar/templates', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ templates: [] }));
    const result = await client().listRunTemplates();
    expect(result).toEqual({ templates: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/templates'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getRunTemplate calls GET /sonar/templates/:id', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ template: { template_id: 'abc' } }));
    await client().getRunTemplate('abc');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/templates/abc'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createRunTemplate calls POST /sonar/templates with body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ template: { template_id: 'new' } }));
    const body = {
      template_name: 'daily-audit',
      observation_class: 'audit' as const,
      cadence: { kind: 'manual_only' as const },
      enabled: true,
      retention_days: 30,
      scope: {
        kind: 'audit' as const,
        authorization_basis: 'bilateral' as const,
        counterparties: ['00000000-0000-0000-0000-000000000002'],
        signal_types: ['lead_time_distribution' as const],
        skus: [],
        depth_limit: 1,
        hop_budget: 5,
      },
    };
    await client().createRunTemplate(body);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('/sonar/templates');
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body as string)).toEqual(body);
  });

  it('updateRunTemplate calls PATCH /sonar/templates/:id with body', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ template: { template_id: 'abc' } }));
    await client().updateRunTemplate('abc', { enabled: false });
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('/sonar/templates/abc');
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body as string)).toEqual({ enabled: false });
  });

  it('deleteRunTemplate calls DELETE /sonar/templates/:id', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ deleted: true }));
    await client().deleteRunTemplate('abc');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/templates/abc'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('triggerRunTemplate calls POST /sonar/templates/:id/trigger', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ run_id: 'run-1' }));
    await client().triggerRunTemplate('abc');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/templates/abc/trigger'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
