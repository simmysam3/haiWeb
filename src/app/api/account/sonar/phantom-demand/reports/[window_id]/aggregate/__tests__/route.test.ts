import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({
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
    fetchRaw,
  }),
}));

import { GET } from '../route';

const WINDOW_ID = '00000000-0000-0000-0000-0000000000aa';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost/api/account/sonar/phantom-demand/reports/${WINDOW_ID}/aggregate${query}`,
  );
}

describe('GET /api/account/sonar/phantom-demand/reports/[window_id]/aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ window_id: WINDOW_ID }),
    });
    expect(res.status).toBe(401);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards the haiCore aggregate report body verbatim on success (default JSON inline)', async () => {
    const report = {
      header: {
        initiator_participant_id: '11111111-1111-1111-1111-111111111111',
        window_id: WINDOW_ID,
        window_days: 30,
        generated_at: '2026-04-29T12:00:00.000Z',
        counterparty_count: 2,
      },
      posture_summary: {
        total_probes: 4,
        response_rate: 0.5,
        median_response_latency_ms: 1200,
        capacity_confidence_distribution: {
          low: 0,
          moderate: 1,
          high: 1,
          at_capacity: 0,
        },
      },
      per_counterparty_summary: [],
      transformation_chain: null,
      lot_batch_lineage: null,
      temporal_validity_window: null,
    };
    fetchRaw.mockResolvedValueOnce(
      new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ window_id: WINDOW_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBeNull();
    expect(await res.json()).toEqual(report);
    expect(fetchRaw).toHaveBeenCalledWith(
      `/sonar/phantom-demand/reports/${WINDOW_ID}/aggregate`,
      { headers: { Accept: 'application/json' } },
    );
  });

  it('forwards a 4xx body verbatim from haiCore (JSON path)', async () => {
    fetchRaw.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'WINDOW_NOT_FOUND', message: 'Window not found' },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      ),
    );
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ window_id: WINDOW_ID }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'WINDOW_NOT_FOUND', message: 'Window not found' },
    });
  });

  it('returns a binary PDF body (arrayBuffer, not JSON) with passthrough Content-Type and forwarded filename', async () => {
    // Simulate the haiCore response — a binary PDF body. We use a small
    // fixed byte sequence (the %PDF- magic header) so the test stays
    // deterministic and asserts that the BFF doesn't accidentally
    // JSON-parse or re-encode the body.
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"
    fetchRaw.mockResolvedValueOnce(
      new Response(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="upstream-name-ignored.pdf"`,
        },
      }),
    );
    const res = await GET(makeRequest('?format=pdf'), {
      params: Promise.resolve({ window_id: WINDOW_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    // BFF synthesises the download filename from the window_id rather
    // than echoing whatever haiCore sent — assert the BFF format.
    expect(res.headers.get('Content-Disposition')).toBe(
      `attachment; filename="phantom-demand-aggregate-${WINDOW_ID}.pdf"`,
    );
    const buf = await res.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(pdfBytes);
    expect(fetchRaw).toHaveBeenCalledWith(
      `/sonar/phantom-demand/reports/${WINDOW_ID}/aggregate`,
      { headers: { Accept: 'application/pdf' } },
    );
  });
});
