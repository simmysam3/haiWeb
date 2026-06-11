import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken, hasRole, client } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(),
  client: {
    getLibrary: vi.fn(),
    setLibraryPolicy: vi.fn(),
    upsertLibraryAttribute: vi.fn(),
    createLibraryUrlArtifact: vi.fn(),
    affirmLibraryItem: vi.fn(),
    rejectLibraryItem: vi.fn(),
    runLibraryGather: vi.fn(),
    uploadLibraryArtifact: vi.fn(),
    getLibraryArtifactFile: vi.fn(),
    listLibraryDocuments: vi.fn(),
    createArtifactFromExisting: vi.fn(),
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

describe('/api/account/library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'account_admin' },
      participant: { id: 'pid' },
    });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  it('GET proxies client.getLibrary and returns its envelope', async () => {
    const view = { sections: [{ section: 'legal_commercial', elements: [] }] };
    client.getLibrary.mockResolvedValueOnce(view);
    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({}),
    });
    const json = await res.json();
    expect(client.getLibrary).toHaveBeenCalled();
    expect(json.sections[0].section).toBe('legal_commercial');
  });

  it('GET serves DEV_LIBRARY_FALLBACK when the token is a non-JWT dev value', async () => {
    getToken.mockResolvedValueOnce('dev-standalone');
    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({}),
    });
    expect(res.headers.get('x-haiwave-data-source')).toBe('fallback');
    expect(client.getLibrary).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.sections).toHaveLength(2);
  });

  it('PUT policies forwards the JSON body to setLibraryPolicy', async () => {
    client.setLibraryPolicy.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../policies/route');
    const body = { element_key: 'iso_9001_cert', context: 'share', tier: 'premier', enabled: true };
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(client.setLibraryPolicy).toHaveBeenCalledWith(body);
    expect(res.status).toBe(200);
  });

  it('PUT attributes forwards elementKey + body', async () => {
    client.upsertLibraryAttribute.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../attributes/[elementKey]/route');
    const body = { value: 'Net 30' };
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ elementKey: 'payment_terms' }) },
    );
    expect(client.upsertLibraryAttribute).toHaveBeenCalledWith('payment_terms', body);
    expect(res.status).toBe(200);
  });

  it('returns 403 on a mutation when the role gate denies', async () => {
    hasRole.mockReturnValue(false);
    const { PUT } = await import('../policies/route');
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify({ element_key: 'x', context: 'share', tier: 'premier', enabled: true }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(client.setLibraryPolicy).not.toHaveBeenCalled();
  });

  it('POST /api/account/library/artifacts forwards FormData to uploadLibraryArtifact and is admin-gated', async () => {
    client.uploadLibraryArtifact.mockResolvedValueOnce({ artifact: { id: 'u1' } });
    const { POST } = await import('../artifacts/route');
    const form = new FormData();
    form.append('file', new File([new Uint8Array(8)], 'doc.pdf', { type: 'application/pdf' }));
    form.append('element_key', 'iso_9001_cert');
    form.append('title', 'ISO 9001 Certificate');
    // jsdom+undici's multipart parser can't re-parse a File part out of a body
    // (round-trip throws); in production Next parses the body and hands the
    // handler a FormData. Stub request.formData() to model that — the route's
    // job is just to forward whatever formData() yields, untouched.
    const req = new NextRequest('http://localhost/x', { method: 'POST' });
    vi.spyOn(req, 'formData').mockResolvedValue(form);
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(client.uploadLibraryArtifact).toHaveBeenCalledTimes(1);
    const forwarded = client.uploadLibraryArtifact.mock.calls[0][0] as FormData;
    expect(forwarded.get('element_key')).toBe('iso_9001_cert');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.artifact.id).toBe('u1');
  });

  it('upload route exports no GET; denies non-admin with 403', async () => {
    const mod = await import('../artifacts/route');
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
    hasRole.mockReturnValue(false);
    const req = new NextRequest('http://localhost/x', { method: 'POST' });
    const formDataSpy = vi.spyOn(req, 'formData');
    const res = await mod.POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(client.uploadLibraryArtifact).not.toHaveBeenCalled();
    // Gate short-circuits before the body is ever read.
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it('GET /api/account/library/artifacts/[id]/file streams upstream body + content headers', async () => {
    client.getLibraryArtifactFile.mockResolvedValueOnce(
      new Response(Buffer.from('%PDF test'), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'inline; filename="doc.pdf"',
          'cache-control': 'private, no-store',
        },
      }),
    );
    const { GET } = await import('../artifacts/[id]/file/route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({ id: 'a1' }),
    });
    expect(client.getLibraryArtifactFile).toHaveBeenCalledWith('a1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    const text = await res.text();
    expect(text).toContain('test');
  });

  it('neutralizes non-allowlisted content types — html serves as an octet-stream download, never inline', async () => {
    client.getLibraryArtifactFile.mockResolvedValueOnce(
      new Response(Buffer.from('<script>alert(1)</script>'), {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'content-disposition': 'inline; filename="snapshot.html"',
        },
      }),
    );
    const { GET } = await import('../artifacts/[id]/file/route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({ id: 'a3' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('file route propagates upstream 404', async () => {
    client.getLibraryArtifactFile.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: {} }), { status: 404 }),
    );
    const { GET } = await import('../artifacts/[id]/file/route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
  });

  it('mutating routes export no GET handler', async () => {
    const policies = await import('../policies/route');
    expect((policies as Record<string, unknown>).GET).toBeUndefined();
    const affirm = await import('../items/[id]/affirm/route');
    expect((affirm as Record<string, unknown>).GET).toBeUndefined();
    const urlArtifacts = await import('../artifacts/url/route');
    expect((urlArtifacts as Record<string, unknown>).GET).toBeUndefined();
    const reject = await import('../items/[id]/reject/route');
    expect((reject as Record<string, unknown>).GET).toBeUndefined();
    const gather = await import('../gather/route');
    expect((gather as Record<string, unknown>).GET).toBeUndefined();
  });

  describe('POST /api/account/library/items/[id]/reject', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { POST } = await import('../items/[id]/reject/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'item-1' }),
      });
      expect(res.status).toBe(401);
      expect(client.rejectLibraryItem).not.toHaveBeenCalled();
    });

    it('returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../items/[id]/reject/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'item-1' }),
      });
      expect(res.status).toBe(403);
      expect(client.rejectLibraryItem).not.toHaveBeenCalled();
    });

    it('proxies client.rejectLibraryItem and returns its envelope', async () => {
      client.rejectLibraryItem.mockResolvedValueOnce({ status: 'rejected' });
      const { POST } = await import('../items/[id]/reject/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'item-1' }),
      });
      expect(client.rejectLibraryItem).toHaveBeenCalledWith('item-1');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('rejected');
    });

    it('propagates a haiCore 404 verbatim', async () => {
      const err = new Error('haiCore POST /library/items/missing/reject: 404') as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = 404;
      err.haiCoreBody = { error: { code: 'NOT_FOUND' } };
      client.rejectLibraryItem.mockRejectedValueOnce(err);
      const { POST } = await import('../items/[id]/reject/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'missing' }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/account/library/documents', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { GET } = await import('../documents/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(client.listLibraryDocuments).not.toHaveBeenCalled();
    });

    it('proxies client.listLibraryDocuments and returns its envelope (no admin role needed, like the library view GET)', async () => {
      hasRole.mockReturnValue(false); // reads are not role-gated
      const envelope = {
        documents: [
          {
            artifact_id: 'a1',
            title: 'ISO 9001 Certificate',
            element_key: 'iso_9001_cert',
            origin: 'upload',
            mime_type: 'application/pdf',
            file_size_bytes: 99,
            source_url: null,
            has_file: true,
            created_at: '2026-06-10T12:00:00Z',
          },
        ],
      };
      client.listLibraryDocuments.mockResolvedValueOnce(envelope);
      const { GET } = await import('../documents/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(client.listLibraryDocuments).toHaveBeenCalled();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.documents[0].artifact_id).toBe('a1');
    });

    it('serves an empty dev fallback when the token is a non-JWT dev value', async () => {
      getToken.mockResolvedValueOnce('dev-standalone');
      const { GET } = await import('../documents/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.headers.get('x-haiwave-data-source')).toBe('fallback');
      expect(client.listLibraryDocuments).not.toHaveBeenCalled();
      const json = await res.json();
      expect(json.documents).toEqual([]);
    });
  });

  describe('POST /api/account/library/artifacts/from-existing', () => {
    const body = {
      element_key: 'iso_14001_cert',
      source_artifact_id: 'a1',
      title: 'ISO 14001 Certificate',
      issuer: 'TUV',
    };

    function makeReq() {
      return new NextRequest('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    }

    it('exports no GET handler', async () => {
      const mod = await import('../artifacts/from-existing/route');
      expect((mod as Record<string, unknown>).GET).toBeUndefined();
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { POST } = await import('../artifacts/from-existing/route');
      const res = await POST(makeReq(), { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
      expect(client.createArtifactFromExisting).not.toHaveBeenCalled();
    });

    it('returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../artifacts/from-existing/route');
      const res = await POST(makeReq(), { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
      expect(client.createArtifactFromExisting).not.toHaveBeenCalled();
    });

    it('forwards the JSON body and returns the artifact envelope', async () => {
      client.createArtifactFromExisting.mockResolvedValueOnce({ artifact: { id: 'a2' } });
      const { POST } = await import('../artifacts/from-existing/route');
      const res = await POST(makeReq(), { params: Promise.resolve({}) });
      expect(client.createArtifactFromExisting).toHaveBeenCalledWith(body);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.artifact.id).toBe('a2');
    });

    it('propagates a haiCore 404 LIBRARY_SOURCE_ARTIFACT_NOT_FOUND verbatim', async () => {
      const err = new Error('haiCore POST /library/artifacts/from-existing: 404') as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = 404;
      err.haiCoreBody = { error: { code: 'LIBRARY_SOURCE_ARTIFACT_NOT_FOUND', message: 'gone' } };
      client.createArtifactFromExisting.mockRejectedValueOnce(err);
      const { POST } = await import('../artifacts/from-existing/route');
      const res = await POST(makeReq(), { params: Promise.resolve({}) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('LIBRARY_SOURCE_ARTIFACT_NOT_FOUND');
    });

    it('propagates a haiCore 400 unknown-element verbatim', async () => {
      const err = new Error('haiCore POST /library/artifacts/from-existing: 400') as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = 400;
      err.haiCoreBody = { error: { code: 'UNKNOWN_ELEMENT', message: 'unknown element' } };
      client.createArtifactFromExisting.mockRejectedValueOnce(err);
      const { POST } = await import('../artifacts/from-existing/route');
      const res = await POST(makeReq(), { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('UNKNOWN_ELEMENT');
    });
  });

  describe('POST /api/account/library/gather', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { POST } = await import('../gather/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(client.runLibraryGather).not.toHaveBeenCalled();
    });

    it('returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../gather/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(403);
      expect(client.runLibraryGather).not.toHaveBeenCalled();
    });

    it('forwards the JSON body and passes haiCore 202 through', async () => {
      client.runLibraryGather.mockResolvedValueOnce({ status: 'started' });
      const { POST } = await import('../gather/route');
      const body = { terms_url: 'https://example.com/terms' };
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );
      expect(client.runLibraryGather).toHaveBeenCalledWith(body);
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.status).toBe('started');
    });

    it('forwards {} when the request has no/invalid JSON body', async () => {
      client.runLibraryGather.mockResolvedValueOnce({ status: 'started' });
      const { POST } = await import('../gather/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(client.runLibraryGather).toHaveBeenCalledWith({});
      expect(res.status).toBe(202);
    });

    it('propagates a haiCore 422 NO_WEBSITE_URL verbatim', async () => {
      const err = new Error('haiCore POST /library/gather: 422') as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = 422;
      err.haiCoreBody = { error: { code: 'NO_WEBSITE_URL' } };
      client.runLibraryGather.mockRejectedValueOnce(err);
      const { POST } = await import('../gather/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error.code).toBe('NO_WEBSITE_URL');
    });

    it('propagates a haiCore 503 verbatim', async () => {
      const err = new Error('haiCore POST /library/gather: 503') as Error & {
        status?: number;
        haiCoreBody?: unknown;
      };
      err.status = 503;
      err.haiCoreBody = { error: { code: 'GATHER_UNAVAILABLE' } };
      client.runLibraryGather.mockRejectedValueOnce(err);
      const { POST } = await import('../gather/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error.code).toBe('GATHER_UNAVAILABLE');
    });
  });
});
