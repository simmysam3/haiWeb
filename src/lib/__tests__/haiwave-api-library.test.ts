import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

function mockFetchOnce(body: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType },
    }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('HaiwaveClient library document-reuse methods', () => {
  const token = 'tok';
  const participantId = 'pid-1234';
  let client: ReturnType<typeof createHaiwaveClient>;

  beforeEach(() => {
    client = createHaiwaveClient(token, participantId);
  });

  it('listLibraryDocuments GETs /library/documents with auth headers and returns the envelope', async () => {
    const envelope = {
      documents: [
        {
          artifact_id: 'a1',
          title: 'ISO 9001 Certificate',
          element_key: 'iso_9001_cert',
          origin: 'upload',
          mime_type: 'application/pdf',
          file_size_bytes: 1234,
          source_url: null,
          has_file: true,
          created_at: '2026-06-10T12:00:00Z',
        },
      ],
    };
    const fetchMock = mockFetchOnce(envelope);
    const res = await client.listLibraryDocuments();
    expect(res).toEqual(envelope);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/library\/documents$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(init.headers['x-haiwave-participant-id']).toBe(participantId);
  });

  it('createArtifactFromExisting POSTs /library/artifacts/from-existing with the body', async () => {
    const fetchMock = mockFetchOnce({ artifact: { id: 'a2' } }, 201);
    const body = {
      element_key: 'iso_14001_cert',
      source_artifact_id: 'a1',
      title: 'ISO 14001 Certificate',
      issuer: 'TUV',
    };
    const res = await client.createArtifactFromExisting(body);
    expect(res).toEqual({ artifact: { id: 'a2' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/library\/artifacts\/from-existing$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('createArtifactFromExisting surfaces a haiCore 404 with status + parsed body on the thrown error', async () => {
    mockFetchOnce(
      { error: { code: 'LIBRARY_SOURCE_ARTIFACT_NOT_FOUND', message: 'Source artifact not found' } },
      404,
    );
    const err = (await client
      .createArtifactFromExisting({ element_key: 'x', source_artifact_id: 'gone', title: 't' })
      .catch((e: unknown) => e)) as Error & { status?: number; haiCoreBody?: unknown };
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect((err.haiCoreBody as { error: { code: string } }).error.code).toBe(
      'LIBRARY_SOURCE_ARTIFACT_NOT_FOUND',
    );
  });
});
