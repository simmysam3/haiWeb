import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

describe('HaiwaveClient evidence methods', () => {
  it('createEvidenceDraft POSTs to the evidence draft endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ draft_response_id: 'd1' }), { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    const c = createHaiwaveClient('tok', 'part-1');
    const out = await c.createEvidenceDraft({
      scope_shape: 'sku_list', skus: ['S'], recipient_name: 'J', recipient_org: 'O', recipient_type: 'customs',
    });
    expect(out.draft_response_id).toBe('d1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sonar/compliance/evidence/draft');
    expect(init?.method).toBe('POST');
  });

  it('getEvidenceDraft GETs the draft by id', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ draft_response_id: 'd2', scope_shape: 'sku_list' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const c = createHaiwaveClient('tok', 'part-1');
    const out = await c.getEvidenceDraft('d2');
    expect(out.draft_response_id).toBe('d2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sonar/compliance/evidence/draft/d2');
    expect(init?.method).toBe('GET');
  });

  it('dispatchEvidenceDraft POSTs to the dispatch endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ dispatch_decision: 'cached', bound_run_id: null, source_run_ids: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const c = createHaiwaveClient('tok', 'part-1');
    const out = await c.dispatchEvidenceDraft('d3', { decision: 'cached' });
    expect(out.dispatch_decision).toBe('cached');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/sonar/compliance/evidence/draft/d3/dispatch');
    expect(init?.method).toBe('POST');
  });
});
