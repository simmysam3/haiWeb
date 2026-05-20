import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  exportEvidence,
  listEvidenceResponses,
  getEvidenceResponse,
  fetchRaw,
  getSession,
  getToken,
} = vi.hoisted(() => ({
  exportEvidence: vi.fn(),
  listEvidenceResponses: vi.fn(),
  getEvidenceResponse: vi.fn(),
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
    exportEvidence,
    listEvidenceResponses,
    getEvidenceResponse,
    fetchRaw,
  }),
}));

import { POST as postExport } from '../../draft/[draft_id]/export/route';
import { GET as getResponses } from '../route';
import { GET as getResponse } from '../[response_id]/route';
import { GET as getDocument } from '../[response_id]/document/route';

const BASE = 'http://localhost/api/account/sonar/compliance/evidence';

describe('evidence P9 BFF routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  // ─── POST /draft/:draft_id/export ────────────────────────────────────────

  it('POST /draft/:id/export calls exportEvidence, returns 201 with payload', async () => {
    const payload = { response_id: 'resp-1', document_hash: 'a'.repeat(64) };
    exportEvidence.mockResolvedValueOnce(payload);
    const res = await postExport(
      new NextRequest(`${BASE}/draft/d-1/export`, { method: 'POST' }),
      { params: Promise.resolve({ draft_id: 'd-1' }) },
    );
    expect(res.status).toBe(201);
    expect(exportEvidence).toHaveBeenCalledWith('d-1');
    expect(await res.json()).toEqual(payload);
  });

  // ─── GET /responses ──────────────────────────────────────────────────────

  it('GET /responses calls listEvidenceResponses, returns 200', async () => {
    const payload = { responses: [{ response_id: 'resp-1' }] };
    listEvidenceResponses.mockResolvedValueOnce(payload);
    const res = await getResponses(
      new NextRequest(`${BASE}/responses`),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(listEvidenceResponses).toHaveBeenCalled();
    expect(await res.json()).toEqual(payload);
  });

  // ─── GET /responses/:response_id ─────────────────────────────────────────

  it('GET /responses/:id calls getEvidenceResponse, returns 200', async () => {
    const payload = { response_id: 'resp-2', document_hash: 'b'.repeat(64) };
    getEvidenceResponse.mockResolvedValueOnce(payload);
    const res = await getResponse(
      new NextRequest(`${BASE}/responses/resp-2`),
      { params: Promise.resolve({ response_id: 'resp-2' }) },
    );
    expect(res.status).toBe(200);
    expect(getEvidenceResponse).toHaveBeenCalledWith('resp-2');
    expect(await res.json()).toEqual(payload);
  });

  // ─── GET /responses/:id/document?format= ─────────────────────────────────

  it('4a: upstream OK, hash header true — forwards Content-Type, X-Document-Hash, X-Document-Hash-Matches=true, disposition', async () => {
    const docHash = 'a'.repeat(64);
    fetchRaw.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'application/json; charset=utf-8';
          if (name === 'X-Document-Hash') return docHash;
          if (name === 'X-Document-Hash-Matches') return 'true';
          return null;
        },
      },
      text: async () => '{"response":"data"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const res = await getDocument(
      new NextRequest(`${BASE}/responses/resp-3/document?format=json`),
      { params: Promise.resolve({ response_id: 'resp-3' }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-Document-Hash')).toBe(docHash);
    expect(res.headers.get('X-Document-Hash-Matches')).toBe('true');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="evidence-response-resp-3.json"');
    expect(await res.text()).toBe('{"response":"data"}');
  });

  it('4b: upstream OK, hash header false — forwards X-Document-Hash-Matches=false', async () => {
    const docHash = 'b'.repeat(64);
    fetchRaw.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'application/json; charset=utf-8';
          if (name === 'X-Document-Hash') return docHash;
          if (name === 'X-Document-Hash-Matches') return 'false';
          return null;
        },
      },
      text: async () => '{"response":"data2"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const res = await getDocument(
      new NextRequest(`${BASE}/responses/resp-4/document?format=json`),
      { params: Promise.resolve({ response_id: 'resp-4' }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Document-Hash-Matches')).toBe('false');
  });

  it('4c: upstream OK, hash headers ABSENT — BFF omits both X-Document-Hash headers (regression seam)', async () => {
    fetchRaw.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'application/json; charset=utf-8';
          // X-Document-Hash and X-Document-Hash-Matches are absent
          return null;
        },
      },
      text: async () => '{"response":"data3"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const res = await getDocument(
      new NextRequest(`${BASE}/responses/resp-5/document?format=json`),
      { params: Promise.resolve({ response_id: 'resp-5' }) },
    );
    expect(res.status).toBe(200);
    // Headers must be absent, not empty string
    expect(res.headers.get('X-Document-Hash')).toBeNull();
    expect(res.headers.get('X-Document-Hash-Matches')).toBeNull();
  });

  it('4d: upstream OK, format=pdf — returns bytes verbatim with Content-Type application/pdf', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake').buffer;
    fetchRaw.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'Content-Type') return 'application/pdf';
          return null;
        },
      },
      text: async () => '',
      arrayBuffer: async () => pdfBytes,
    });
    const res = await getDocument(
      new NextRequest(`${BASE}/responses/resp-6/document?format=pdf`),
      { params: Promise.resolve({ response_id: 'resp-6' }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/pdf');
    const buf = await res.arrayBuffer();
    expect(new TextDecoder().decode(buf)).toContain('%PDF');
  });

  it('4e: upstream non-OK 404 — BFF forwards status 404 with parseable JSON error body', async () => {
    fetchRaw.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: 'not found' }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const res = await getDocument(
      new NextRequest(`${BASE}/responses/resp-missing/document?format=json`),
      { params: Promise.resolve({ response_id: 'resp-missing' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body).toHaveProperty('error');
  });
});
