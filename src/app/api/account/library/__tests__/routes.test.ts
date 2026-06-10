import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockClient = {
  getLibrary: vi.fn(),
  setLibraryPolicy: vi.fn(),
  upsertLibraryAttribute: vi.fn(),
  createLibraryUrlArtifact: vi.fn(),
  affirmLibraryItem: vi.fn(),
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore:
    (handler: (ctx: unknown) => unknown) =>
    async (request: unknown, routeCtx?: { params: Promise<Record<string, string>> }) => {
      const result = await handler({
        client: mockClient,
        session: { participant: { id: 'pid' } },
        request,
        params: routeCtx ? await routeCtx.params : {},
      });
      return result instanceof NextResponse ? result : NextResponse.json(result);
    },
}));

describe('/api/account/library', () => {
  beforeEach(() => {
    mockClient.getLibrary.mockReset();
    mockClient.setLibraryPolicy.mockReset();
    mockClient.upsertLibraryAttribute.mockReset();
    mockClient.createLibraryUrlArtifact.mockReset();
    mockClient.affirmLibraryItem.mockReset();
  });

  it('GET delegates to client.getLibrary and returns its envelope', async () => {
    const view = { sections: [{ section: 'legal_commercial', elements: [] }] };
    mockClient.getLibrary.mockResolvedValueOnce(view);
    const { GET } = await import('../route');
    const request = new NextRequest('http://localhost/x', { method: 'GET' });
    const res = await GET(request, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(mockClient.getLibrary).toHaveBeenCalled();
    expect(json.sections[0].section).toBe('legal_commercial');
  });

  it('PUT policies forwards the JSON body to setLibraryPolicy', async () => {
    mockClient.setLibraryPolicy.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../policies/route');
    const body = { element_key: 'iso_9001_cert', context: 'share', tier: 'premier', enabled: true };
    const request = new NextRequest('http://localhost/x', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(request, { params: Promise.resolve({}) });
    expect(mockClient.setLibraryPolicy).toHaveBeenCalledWith(body);
    expect(res.status).toBe(200);
  });

  it('PUT attributes forwards elementKey + body', async () => {
    mockClient.upsertLibraryAttribute.mockResolvedValueOnce({ ok: true });
    const { PUT } = await import('../attributes/[elementKey]/route');
    const body = { value: 'Net 30' };
    const request = new NextRequest('http://localhost/x', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await PUT(request, { params: Promise.resolve({ elementKey: 'payment_terms' }) });
    expect(mockClient.upsertLibraryAttribute).toHaveBeenCalledWith('payment_terms', body);
    expect(res.status).toBe(200);
  });

  it('POST artifacts/url forwards the JSON body to createLibraryUrlArtifact', async () => {
    mockClient.createLibraryUrlArtifact.mockResolvedValueOnce({ artifact: { id: 'a1' } });
    const { POST } = await import('../artifacts/url/route');
    const body = { element_key: 'iso_9001_cert', title: 'Cert', source_url: 'https://x/c.pdf' };
    const request = new NextRequest('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(request, { params: Promise.resolve({}) });
    expect(mockClient.createLibraryUrlArtifact).toHaveBeenCalledWith(body);
    expect(res.status).toBe(200);
  });

  it('POST affirm forwards the item id', async () => {
    mockClient.affirmLibraryItem.mockResolvedValueOnce({ ok: true });
    const { POST } = await import('../items/[id]/affirm/route');
    const request = new NextRequest('http://localhost/x', { method: 'POST' });
    const res = await POST(request, { params: Promise.resolve({ id: 'art-1' }) });
    expect(mockClient.affirmLibraryItem).toHaveBeenCalledWith('art-1');
    expect(res.status).toBe(200);
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
