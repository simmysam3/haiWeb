import { describe, it, expect, vi, afterEach } from 'vitest';
import { smFetch } from '../client';

afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

describe('smFetch', () => {
  it('sends a JSON string body and returns the parsed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { project_id: 'p1' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await smFetch<{ project_id: string }>('/api/account/sourcing-map/projects', { method: 'POST', body: { name: 'Spring 2027' } });
    expect(out).toEqual({ ok: true, status: 201, data: { project_id: 'p1' } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body)).toEqual({ name: 'Spring 2027' });
  });

  it('turns failures into a sentence: session, envelope, string, status, network, and relays 204 as null', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(reply(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(reply(409, { error: { code: 'execution_in_progress', message: 'Line A base is running.' } }))
      .mockResolvedValueOnce(reply(403, { error: 'Forbidden' }))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '<html>oops</html>' })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(reply(204)));
    const a = await smFetch('/a');
    const b = await smFetch('/b');
    const c = await smFetch('/c');
    const d = await smFetch('/d');
    const e = await smFetch('/e');
    const f = await smFetch('/f');
    expect(a).toMatchObject({ ok: false, status: 401, message: 'Your session has expired. Please sign in again.' });
    expect(b).toMatchObject({ ok: false, status: 409, message: 'Line A base is running.' });
    expect(c).toMatchObject({ ok: false, status: 403, message: 'Forbidden' });
    expect(d).toMatchObject({ ok: false, status: 500, message: 'Request failed (500).' });
    expect(e).toMatchObject({ ok: false, status: 0, message: 'The request did not reach the server. Check your connection and try again.' });
    expect(f).toEqual({ ok: true, status: 204, data: null });
  });

  it('returns a failure, never throws, when the body read drops after the headers arrive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('network')),
    } as Response));
    const out = await smFetch('/g');
    expect(out).toEqual({
      ok: false,
      status: 200,
      message: 'The request did not reach the server. Check your connection and try again.',
      body: null,
    });
  });
});
