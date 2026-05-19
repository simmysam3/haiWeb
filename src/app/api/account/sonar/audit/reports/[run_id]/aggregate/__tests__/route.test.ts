import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getAggregateReport, fetchRaw, getSession, getToken } = vi.hoisted(() => ({
  getAggregateReport: vi.fn(),
  fetchRaw: vi.fn(),
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
    getAggregateReport,
    fetchRaw,
  }),
}));

import { GET } from '../route';

const RUN_ID = '00000000-0000-0000-0000-000000000001';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/account/sonar/audit/reports/${RUN_ID}/aggregate${query}`,
  );
}

describe('GET /api/account/sonar/audit/reports/[run_id]/aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ run_id: RUN_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns JSON inline by default (no format param)', async () => {
    const report = { report_type: 'aggregate', header: { run_id: RUN_ID } };
    getAggregateReport.mockResolvedValue(report);
    const res = await GET(makeRequest(), { params: Promise.resolve({ run_id: RUN_ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBeNull();
    expect(await res.json()).toEqual(report);
  });

  it('returns JSON download with Content-Disposition on format=json', async () => {
    const report = { report_type: 'aggregate', header: { run_id: RUN_ID } };
    getAggregateReport.mockResolvedValue(report);
    const res = await GET(makeRequest('?format=json'), {
      params: Promise.resolve({ run_id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Disposition')).toBe(
      `attachment; filename="aggregate-${RUN_ID}.json"`,
    );
    expect(JSON.parse(await res.text())).toEqual(report);
  });

  it('returns CSV download with Content-Disposition on format=csv', async () => {
    const csvBody = 'vendor_legal_name,product_id\nAcme,p1\n';
    fetchRaw.mockResolvedValue(
      new Response(csvBody, {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      }),
    );
    const res = await GET(makeRequest('?format=csv'), {
      params: Promise.resolve({ run_id: RUN_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toBe(
      `attachment; filename="aggregate-${RUN_ID}.csv"`,
    );
    expect(await res.text()).toBe(csvBody);
    expect(fetchRaw).toHaveBeenCalledWith(
      `/sonar/compliance/reports/${RUN_ID}/aggregate`,
      { headers: { Accept: 'text/csv' } },
    );
  });

  it('propagates haiCore 4xx body verbatim on the csv path when JSON-parseable', async () => {
    fetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      ),
    );
    const res = await GET(makeRequest('?format=csv'), {
      params: Promise.resolve({ run_id: RUN_ID }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
    });
  });

  it('falls back to opaque error on the csv path when haiCore body is not JSON', async () => {
    fetchRaw.mockResolvedValue(
      new Response('Internal Server Error\n', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }),
    );
    const res = await GET(makeRequest('?format=csv'), {
      params: Promise.resolve({ run_id: RUN_ID }),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'haiCore returned 502' });
  });

  it('propagates haiCore 4xx body verbatim', async () => {
    const haiCoreErr = Object.assign(new Error('haiCore 404'), {
      status: 404,
      haiCoreBody: { error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' } },
    });
    getAggregateReport.mockRejectedValueOnce(haiCoreErr);
    const res = await GET(makeRequest(), { params: Promise.resolve({ run_id: RUN_ID }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'REPORT_NOT_FOUND', message: 'Report not found' },
    });
  });

  it('returns 500 when haiCore raises a non-4xx error (json default)', async () => {
    getAggregateReport.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(makeRequest(), { params: Promise.resolve({ run_id: RUN_ID }) });
    expect(res.status).toBe(500);
  });
});
