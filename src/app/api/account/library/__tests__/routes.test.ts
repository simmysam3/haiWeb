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

  it('mutating routes export no GET handler', async () => {
    const policies = await import('../policies/route');
    expect((policies as Record<string, unknown>).GET).toBeUndefined();
    const affirm = await import('../items/[id]/affirm/route');
    expect((affirm as Record<string, unknown>).GET).toBeUndefined();
    const urlArtifacts = await import('../artifacts/url/route');
    expect((urlArtifacts as Record<string, unknown>).GET).toBeUndefined();
  });
});
