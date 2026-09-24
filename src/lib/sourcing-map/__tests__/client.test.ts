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
});
