import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `next/headers` is a server-only module; mock the `headers()` accessor
// the helper uses to reconstruct the BFF URL + forward cookies.
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get(name: string): string | null {
      const lower = name.toLowerCase();
      if (lower === 'x-forwarded-proto') return 'https';
      if (lower === 'host') return 'example.test';
      if (lower === 'cookie') return 'sid=abc123';
      return null;
    },
  })),
}));

import { fetchBffJson } from '../server-fetch';

interface SamplePayload {
  ok: boolean;
  items: number;
}

describe('fetchBffJson', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Ensure each test installs its own fetch mock.
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('returns { kind: "ok", data } when the response is 200 + JSON', async () => {
    const body: SamplePayload = { ok: true, items: 3 };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await fetchBffJson<SamplePayload>('/api/sample?foo=1');

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data).toEqual(body);
    }

    // Cookie + proto + host are forwarded into the reconstructed URL.
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://example.test/api/sample?foo=1');
    expect(call[1]).toMatchObject({
      headers: { cookie: 'sid=abc123' },
      cache: 'no-store',
    });
  });

  it('returns { kind: "error", status, message } on a non-OK status', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Service Unavailable: queue full', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await fetchBffJson<SamplePayload>('/api/sample');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(503);
      expect(result.message).toBe('Service Unavailable: queue full');
    }
  });

  it('falls back to a generated message when the error body is empty', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 500 }),
    );

    const result = await fetchBffJson<SamplePayload>('/api/sample');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(500);
      expect(result.message).toBe('Request failed (500)');
    }
  });

  it('returns { kind: "error", status: 0, message } when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('ECONNREFUSED 127.0.0.1:3000'),
    );

    const result = await fetchBffJson<SamplePayload>('/api/sample');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(0);
      expect(result.message).toBe('ECONNREFUSED 127.0.0.1:3000');
    }
  });

  it('returns a fallback message when the thrown value is not an Error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('boom');

    const result = await fetchBffJson<SamplePayload>('/api/sample');

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(0);
      expect(result.message).toBe('Network error');
    }
  });
});
