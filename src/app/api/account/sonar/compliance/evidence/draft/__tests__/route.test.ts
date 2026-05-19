import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { createEvidenceDraft, getEvidenceDraft, dispatchEvidenceDraft, getSession, getToken } = vi.hoisted(() => ({
  createEvidenceDraft: vi.fn(),
  getEvidenceDraft: vi.fn(),
  dispatchEvidenceDraft: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    createEvidenceDraft,
    getEvidenceDraft,
    dispatchEvidenceDraft,
  }),
}));

import { POST as postDraft } from '../route';
import { GET as getDraft } from '../[draft_id]/route';
import { POST as postDispatch } from '../[draft_id]/dispatch/route';

const BASE = 'http://localhost/api/account/sonar/compliance/evidence/draft';

describe('evidence draft BFF routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('POST /draft returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await postDraft(new NextRequest(BASE, { method: 'POST', body: '{}' }), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(createEvidenceDraft).not.toHaveBeenCalled();
  });

  it('POST /draft proxies createEvidenceDraft', async () => {
    const payload = { draft_response_id: 'd1', scope_shape: 'sku_list' };
    createEvidenceDraft.mockResolvedValueOnce(payload);
    const req = new NextRequest(BASE, {
      method: 'POST',
      body: JSON.stringify({ scope_shape: 'sku_list', recipient_name: 'J', recipient_org: 'O', recipient_type: 'customs' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await postDraft(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(createEvidenceDraft).toHaveBeenCalled();
    expect(await res.json()).toEqual(payload);
  });

  it('GET /draft/[id] proxies getEvidenceDraft', async () => {
    const payload = { draft_response_id: 'd2' };
    getEvidenceDraft.mockResolvedValueOnce(payload);
    const res = await getDraft(
      new NextRequest(`${BASE}/d2`),
      { params: Promise.resolve({ draft_id: 'd2' }) },
    );
    expect(res.status).toBe(200);
    expect(getEvidenceDraft).toHaveBeenCalledWith('d2');
    expect(await res.json()).toEqual(payload);
  });

  it('POST /draft/[id]/dispatch proxies dispatchEvidenceDraft', async () => {
    const payload = { dispatch_decision: 'cached', bound_run_id: null, source_run_ids: [] };
    dispatchEvidenceDraft.mockResolvedValueOnce(payload);
    const res = await postDispatch(
      new NextRequest(`${BASE}/d3/dispatch`, { method: 'POST', body: JSON.stringify({ decision: 'cached' }), headers: { 'content-type': 'application/json' } }),
      { params: Promise.resolve({ draft_id: 'd3' }) },
    );
    expect(res.status).toBe(200);
    expect(dispatchEvidenceDraft).toHaveBeenCalledWith('d3', { decision: 'cached' });
    expect(await res.json()).toEqual(payload);
  });
});
