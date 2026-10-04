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

import * as route from '../route';

const { POST } = route;

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

/** A haiCore reply whose body is `bytes`, sent as one chunk and closed. */
function streamUpstream(bytes: Uint8Array, contentType: string, status = 200): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    { status, headers: { 'content-type': contentType } },
  );
}

/** A JSON body of exactly `bytes` UTF-8 bytes, padded with ASCII in `message`. */
function bodyOfBytes(bytes: number): string {
  const empty = JSON.stringify({ message: '', page_route: '/', language: 'en' });
  return JSON.stringify({ message: 'x'.repeat(bytes - Buffer.byteLength(empty, 'utf8')), page_route: '/', language: 'en' });
}

const PENDING = Symbol('pending');

/** `p`, or PENDING when it has not settled within `ms` (the relay must not wait for the whole stream). */
async function within<T>(p: Promise<T>, ms = 2_000): Promise<T | typeof PENDING> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<typeof PENDING>((resolve) => (timer = setTimeout(() => resolve(PENDING), ms)))]);
  } finally {
    clearTimeout(timer);
  }
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
  vi.unstubAllEnvs();
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

// Task 3.4 review, round 1: the body limit's exact edge, the byte-for-byte stream
// relay (phase-3 constraint; contract C.3), and how haiCore is called (C.6, spec §9.3).
describe('POST /api/help/messages: body limit, stream relay and the call to haiCore', () => {
  it('forwards a body of exactly 70,000 bytes', async () => {
    const body = bodyOfBytes(70_000);
    expect(Buffer.byteLength(body, 'utf8')).toBe(70_000);
    const res = await post(body);
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(body);
  });

  it('refuses a body of 70,001 bytes with 413, without calling haiCore', async () => {
    const body = bodyOfBytes(70_001);
    expect(Buffer.byteLength(body, 'utf8')).toBe(70_001);
    const res = await post(body);
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a 16,000-character Korean message (48,000 bytes) with a 200-character Korean route', async () => {
    const body = JSON.stringify({
      conversation_id: '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10',
      message: '가'.repeat(16_000),
      page_route: '/' + '가'.repeat(199),
      language: 'ko',
    });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(body);
  });

  it('passes the stream through: the first event reaches the browser while haiCore is still streaming', async () => {
    const enc = new TextEncoder();
    let upstream!: ReadableStreamDefaultController<Uint8Array>;
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            upstream = c;
            c.enqueue(enc.encode('event: meta\ndata: {}\n\n'));
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );
    const res = await within(post());
    expect(res).not.toBe(PENDING);
    const reader = (res as Response).body!.getReader();
    const first = await within(reader.read());
    expect(first).not.toBe(PENDING);
    const dec = new TextDecoder();
    expect(dec.decode((first as ReadableStreamReadResult<Uint8Array>).value)).toBe('event: meta\ndata: {}\n\n');
    upstream.enqueue(enc.encode('event: done\ndata: {}\n\n'));
    upstream.close();
    expect(dec.decode((await reader.read()).value)).toBe('event: done\ndata: {}\n\n');
    expect((await reader.read()).done).toBe(true);
  });

  it('relays the stream byte for byte, even bytes that are not valid UTF-8', async () => {
    const raw = new Uint8Array([0x64, 0x61, 0x74, 0x61, 0x3a, 0x20, 0xff, 0xfe, 0xc3, 0x0a, 0x0a]);
    fetchMock.mockResolvedValue(streamUpstream(raw, 'text/event-stream; charset=utf-8'));
    const res = await post();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(raw);
  });

  it('answers with the contract content type even when haiCore labels the stream without a charset', async () => {
    fetchMock.mockResolvedValue(streamUpstream(new TextEncoder().encode('event: meta\ndata: {}\n\n'), 'text/event-stream'));
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
  });

  it('relays an error reply labelled as an event stream with its own status, never as a 200 stream', async () => {
    fetchMock.mockResolvedValue(streamUpstream(new TextEncoder().encode('event: error\ndata: {}\n\n'), 'text/event-stream; charset=utf-8', 500));
    const res = await post();
    expect(res.status).toBe(500);
    expect(res.headers.get('x-accel-buffering')).toBeNull();
  });

  it('calls the haiCore named by HAIWAVE_API_URL, at exactly /api/v1/help/messages', async () => {
    vi.stubEnv('HAIWAVE_API_URL', 'http://core.test:3999');
    await post();
    expect(fetchMock.mock.calls[0][0]).toBe('http://core.test:3999/api/v1/help/messages');
  });

  it('reads the served guide once per question, from its default directory', async () => {
    fetchMock.mockImplementation(async () => sseUpstream());
    await post();
    await post();
    expect(readServedGuide.mock.calls).toEqual([[], []]);
  });

  it('404 while the flag is off even for a caller with no session, without reading the session', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    getSession.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an empty body as JSON too (haiCore answers it with its own 400)', async () => {
    await post('');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it.each([
    ['JSON with its own spacing', '{ "message" : "hi",\n  "page_route":"/", "language":"en" }'],
    ['text that is not JSON', '{oops'],
  ])('forwards %s exactly as sent (haiCore validates it)', async (_what, body) => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(body);
  });

  it('runs on the Node runtime (the body limit uses Buffer)', () => {
    expect(route.runtime).toBe('nodejs');
  });
});
