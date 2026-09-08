import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken, hasRole, client } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(),
  client: {
    getCounterpartyManifest: vi.fn(),
    updateCounterpartyManifest: vi.fn(),
    updatePricingManifest: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => client,
}));

const JWT = 'header.payload.signature';

function minimalManifest() {
  return {
    manifest_id: 'm-1',
    participant_id: 'pid',
    manifest_type: 'counterparty',
    version: 1,
    effective_date: '2026-01-01T00:00:00Z',
    baseline_requirements: {
      lead_time_trend_sharing: 'not_required',
      some_other_field: 'kept',
    },
  };
}

describe('/api/account/manifests PUT counterparty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'account_admin' },
      participant: { id: 'pid' },
    });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  it('reads the current manifest and merges lead_time_trend_sharing into baseline_requirements', async () => {
    client.getCounterpartyManifest.mockResolvedValueOnce(minimalManifest());
    client.updateCounterpartyManifest.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../route');
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ type: 'counterparty', data: { lead_time_trend_sharing: 'prefer' } }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(client.getCounterpartyManifest).toHaveBeenCalledWith('pid');
    expect(client.updateCounterpartyManifest).toHaveBeenCalledTimes(1);
    const sent = client.updateCounterpartyManifest.mock.calls[0][0] as Record<string, unknown>;
    // Full manifest passed through, not the raw trimmed data.
    expect(sent.manifest_id).toBe('m-1');
    expect(sent.participant_id).toBe('pid');
    expect(sent.manifest_type).toBe('counterparty');
    expect(sent.version).toBe(1);
    expect(sent.effective_date).toBe('2026-01-01T00:00:00Z');
    const baseline = sent.baseline_requirements as Record<string, unknown>;
    expect(baseline.lead_time_trend_sharing).toBe('prefer');
    // Existing baseline fields preserved.
    expect(baseline.some_other_field).toBe('kept');
    expect(res.status).toBe(200);
  });

  it('answers 409 with the on-file sentence when haiCore has no counterparty manifest (the client rejects with its 404)', async () => {
    // O-5 (hw-d6 walk 2026-09-07): `request()` REJECTS on haiCore's 404 — it never
    // resolves null — so a guard on `!current` is dead and the raw 404 envelope
    // escaped to the console. The BFF must catch that rejection and answer the
    // handled status with a sentence the console can render.
    const notFound = Object.assign(
      new Error("haiCore GET /manifest/counterparty/pid: 404 {\"error\":{\"code\":\"NOT_FOUND\"}}"),
      {
        status: 404,
        haiCoreBody: { error: { code: 'NOT_FOUND', message: "No counterparty manifest found for participant 'pid'" } },
      },
    );
    client.getCounterpartyManifest.mockRejectedValueOnce(notFound);
    const { PUT } = await import('../route');
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ type: 'counterparty', data: { lead_time_trend_sharing: 'prefer' } }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(409);
    expect(client.updateCounterpartyManifest).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe('No counterparty manifest on file yet');
  });

  it('still relays any other haiCore 4xx verbatim (a 403 is not a missing manifest)', async () => {
    const forbidden = Object.assign(new Error('haiCore GET /manifest/counterparty/pid: 403'), {
      status: 403,
      haiCoreBody: { error: { code: 'FORBIDDEN', message: 'nope' } },
    });
    client.getCounterpartyManifest.mockRejectedValueOnce(forbidden);
    const { PUT } = await import('../route');
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ type: 'counterparty', data: { lead_time_trend_sharing: 'prefer' } }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(client.updateCounterpartyManifest).not.toHaveBeenCalled();
  });

  it('pricing type still forwards data directly to updatePricingManifest', async () => {
    client.updatePricingManifest.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../route');
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ type: 'pricing', data: { default_currency: 'USD' } }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(client.updatePricingManifest).toHaveBeenCalledWith({ default_currency: 'USD' });
    expect(client.getCounterpartyManifest).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
