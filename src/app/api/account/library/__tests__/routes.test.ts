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
    uploadLibraryArtifact: vi.fn(),
    getLibraryArtifactFile: vi.fn(),
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
    const text = await res.text();
    expect(text).toContain('test');
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
  });
});
