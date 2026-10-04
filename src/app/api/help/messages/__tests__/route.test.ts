// @vitest-environment node
// src/app/api/help/messages/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

const { getSession, getToken, readServedGuide } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  readServedGuide: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSession, getToken }));
vi.mock('@/lib/help/served-guide', () => ({ readServedGuide }));

import { POST } from '../route';

const SESSION = { user: { id: 'user-1' }, participant: { id: 'participant-1' }, is_admin: false };
const BODY = JSON.stringify({ message: 'Why does docker build fail?', page_route: '/account/agent-software', language: 'en' });
const SSE = 'event: meta\ndata: {}\n\nevent: delta\ndata: {"text":"Hi"}\n\nevent: done\ndata: {}\n\n';
const fetchMock = vi.fn();

function post(body: string = BODY, signal?: AbortSignal) {
  return POST(
    new NextRequest('http://localhost/api/help/messages', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      signal,
    }),
  );
}

function sseUpstream(text: string = SSE): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}

function jsonUpstream(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HELP_AGENT_ENABLED = 'true';
  getSession.mockResolvedValue(SESSION);
  getToken.mockResolvedValue('header.payload.signature');
  readServedGuide.mockResolvedValue({ guideSha: 'a'.repeat(64), agentVersion: '1.102.0' });
  fetchMock.mockResolvedValue(sseUpstream());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete process.env.HELP_AGENT_ENABLED;
  vi.unstubAllGlobals();
});

describe('POST /api/help/messages (BFF stream pass-through)', () => {
  it('404 while HELP_AGENT_ENABLED is off, without touching haiCore', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    const res = await post();
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 without a session', async () => {
    getSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 with a non-JWT token', async () => {
    getToken.mockResolvedValue('dev-placeholder');
    expect((await post()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the body with Bearer, participant, protocol and served-guide headers', async () => {
    await post();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/help\/messages$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(BODY);
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer header.payload.signature');
    expect(h['x-haiwave-participant-id']).toBe('participant-1');
    expect(h['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
    expect(h['Content-Type']).toBe('application/json');
    expect(h['x-help-served-guide-sha']).toBe('a'.repeat(64));
    expect(h['x-help-served-agent-version']).toBe('1.102.0');
  });

  it('omits a served header it cannot read (haiCore treats absence as a mismatch)', async () => {
    readServedGuide.mockResolvedValue({ guideSha: null, agentVersion: '1.102.0' });
    await post();
    const h = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(h).not.toHaveProperty('x-help-served-guide-sha');
    expect(h['x-help-served-agent-version']).toBe('1.102.0');
  });

  it('omits the agent-version header when no agent zip has been built', async () => {
    readServedGuide.mockResolvedValue({ guideSha: 'a'.repeat(64), agentVersion: null });
    await post();
    const h = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(h).not.toHaveProperty('x-help-served-agent-version');
    expect(h['x-help-served-guide-sha']).toBe('a'.repeat(64));
  });

  it('streams the SSE body through unchanged with the stream headers', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(await res.text()).toBe(SSE);
  });

  it('relays a haiCore JSON error verbatim (429 BUDGET_EXHAUSTED)', async () => {
    const body = { error: { code: 'BUDGET_EXHAUSTED', message: 'Daily cap reached', timestamp: 't', request_id: 'r', details: { reset_at: '2026-10-08T00:00:00.000Z', contact: 'support@haiwave.ai' } } };
    fetchMock.mockResolvedValue(jsonUpstream(429, body));
    const res = await post();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual(body);
  });

  it('relays haiCore 401 as 401 (Review Focus #4: token expired upstream)', async () => {
    fetchMock.mockResolvedValue(jsonUpstream(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }));
    expect((await post()).status).toBe(401);
  });

  // Amendment P3-3: haiCore answers a body it cannot accept with 400 VALIDATION_ERROR,
  // and the BFF relays that like any other 400.
  it('relays a haiCore error reply with the content type haiCore gave it (400 VALIDATION_ERROR)', async () => {
    const text = '{"error":{"code":"VALIDATION_ERROR","message":"Invalid request body"}}';
    fetchMock.mockResolvedValue(new Response(text, { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } }));
    const res = await post();
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await res.text()).toBe(text);
  });

  it('labels an error reply that carries no content type as JSON', async () => {
    const text = '{"error":{"code":"INTERNAL_ERROR"}}';
    // A byte body gets no default content type, unlike a string body.
    const upstream = new Response(new TextEncoder().encode(text), { status: 500 });
    expect(upstream.headers.get('content-type')).toBeNull();
    fetchMock.mockResolvedValue(upstream);
    const res = await post();
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.text()).toBe(text);
  });

  it('relays a 200 reply that is not an event stream as it is, without the stream headers', async () => {
    fetchMock.mockResolvedValue(jsonUpstream(200, { ok: true }));
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('x-accel-buffering')).toBeNull();
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('relays a reply that has no body as it is, even one labelled as an event stream (a 204 never becomes a 200 stream)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }));
    const res = await post();
    expect(res.status).toBe(204);
    expect(res.headers.get('x-accel-buffering')).toBeNull();
  });

  it('502 when haiCore is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect((await post()).status).toBe(502);
  });

  it('413 for a body over 70,000 bytes, without calling haiCore', async () => {
    const res = await post(JSON.stringify({ message: 'x'.repeat(70_001), page_route: '/', language: 'en' }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('measures the body in UTF-8 bytes, not characters (a Korean body under 70,000 characters but over 70,000 bytes is refused)', async () => {
    const body = JSON.stringify({ message: '가'.repeat(23_400), page_route: '/', language: 'ko' });
    expect(body.length).toBeLessThan(70_000);
    expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(70_000);
    const res = await post(body);
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborting the browser request aborts the upstream fetch', async () => {
    const ac = new AbortController();
    await post(BODY, ac.signal);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(false);
    ac.abort();
    expect(init.signal?.aborted).toBe(true);
  });
});
