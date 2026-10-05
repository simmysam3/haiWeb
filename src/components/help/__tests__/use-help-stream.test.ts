// src/components/help/__tests__/use-help-stream.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { postHelpMessage, useHelpStream, HELP_MESSAGES_ENDPOINT } from '../use-help-stream';

const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const UMSG = 'b5d4c3a2-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const AMSG = 'c6e5d4b3-2a1f-4e0d-9c8b-7a6f5e4d3c2b';
const META = {
  conversation_id: CONV,
  user_message_id: UMSG,
  redacted_message: 'KEY=‹redacted›',
  redaction_count: 1,
  pack: { version: '2026-10-07.1', guide_edition: '1.7', pack_date: '2026-10-07' },
  served: { guide_sha: 'a'.repeat(64), agent_version: '1.102.0', matches_pack: true },
};
const DONE = { assistant_message_id: AMSG, finish_reason: 'STOP', usage: { input: 100, cached: 90, output: 20 } };
const REQ = { message: 'KEY=abc', page_route: '/account', language: 'en' as const };
const ev = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}
function sseBytes(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(ch);
        c.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}
/** A stream that stays open after its chunks, as a connection that lingers past the terminal event. */
function openSse(chunks: string[], cancel: (reason: unknown) => void = () => undefined): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
      },
      cancel,
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}
/** A stream that delivers its chunks one read at a time, then fails the next read with `failure`. */
function failingSse(chunks: string[], failure: unknown): Response {
  const enc = new TextEncoder();
  let next = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(c) {
        if (next < chunks.length) c.enqueue(enc.encode(chunks[next++]));
        else c.error(failure);
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}
/** A stream that stays open until `signal` aborts, then errors (as a browser's fetch body does) or closes. */
function abortableSse(chunks: string[], signal: AbortSignal, onAbort: 'error' | 'close'): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        signal.addEventListener('abort', () => (onAbort === 'error' ? c.error(new DOMException('aborted', 'AbortError')) : c.close()));
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const callbacks = () => ({ onMeta: vi.fn(), onDelta: vi.fn() });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postHelpMessage', () => {
  it('posts JSON to the BFF and streams meta → deltas → done', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('delta', { text: 'Run ' }), ev('delta', { text: '`npm ci`' }), ev('done', DONE)]));
    const cb = callbacks();
    const outcome = await postHelpMessage(REQ, cb, new AbortController().signal);
    expect(outcome).toEqual({ kind: 'done', done: DONE });
    expect(cb.onMeta).toHaveBeenCalledWith(META);
    expect(cb.onDelta.mock.calls.map((c) => c[0])).toEqual(['Run ', '`npm ci`']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HELP_MESSAGES_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(REQ);
  });

  it('labels the request body as JSON', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('done', DONE)]));
    await postHelpMessage(REQ, callbacks(), new AbortController().signal);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('posts to the BFF route /api/help/messages', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('done', DONE)]));
    await postHelpMessage(REQ, callbacks(), new AbortController().signal);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/help/messages');
  });

  it('reassembles events split across network chunks', async () => {
    const all = ev('meta', META) + ev('delta', { text: 'Hello' }) + ev('done', DONE);
    fetchMock.mockResolvedValue(sse([all.slice(0, 7), all.slice(7, 120), all.slice(120)]));
    const cb = callbacks();
    expect((await postHelpMessage(REQ, cb, new AbortController().signal)).kind).toBe('done');
    expect(cb.onDelta).toHaveBeenCalledWith('Hello');
  });

  it('decodes a character whose bytes are split across network chunks', async () => {
    const enc = new TextEncoder();
    const bytes = enc.encode(ev('meta', META) + ev('delta', { text: '한국어' }) + ev('done', DONE));
    const cut = enc.encode(ev('meta', META) + 'event: delta\ndata: {"text":"').length + 1; // inside 한's three bytes
    fetchMock.mockResolvedValue(sseBytes([bytes.slice(0, cut), bytes.slice(cut)]));
    const cb = callbacks();
    expect((await postHelpMessage(REQ, cb, new AbortController().signal)).kind).toBe('done');
    expect(cb.onDelta.mock.calls.map((c) => c[0])).toEqual(['한국어']);
  });

  it('returns stream_error for an error event', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('error', { code: 'withheld', retryable: false })]));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'stream_error',
      error: { code: 'withheld', retryable: false },
    });
  });

  it('401 → session_expired (Review Focus #4)', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'Unauthorized' }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({ kind: 'session_expired' });
  });

  it('429 BUDGET_EXHAUSTED → http_error with reset time and contact', async () => {
    fetchMock.mockResolvedValue(
      json(429, { error: { code: 'BUDGET_EXHAUSTED', message: 'x', timestamp: 't', request_id: 'r', details: { reset_at: '2026-10-08T00:00:00.000Z', contact: 'support@haiwave.ai' } } }),
    );
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 429,
      code: 'BUDGET_EXHAUSTED',
      resetAt: '2026-10-08T00:00:00.000Z',
      contact: 'support@haiwave.ai',
    });
  });

  it('503 → http_error carrying haiCore’s code', async () => {
    fetchMock.mockResolvedValue(json(503, { error: { code: 'NO_ACTIVE_PACK', message: 'x' } }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toMatchObject({ kind: 'http_error', status: 503, code: 'NO_ACTIVE_PACK' });
  });

  it('400 VALIDATION_ERROR → http_error carrying the code', async () => {
    fetchMock.mockResolvedValue(json(400, { error: { code: 'VALIDATION_ERROR', message: 'message too long' } }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toMatchObject({ kind: 'http_error', status: 400, code: 'VALIDATION_ERROR' });
  });

  it('a BFF error with a string body → http_error with a null code', async () => {
    fetchMock.mockResolvedValue(json(404, { error: 'Not found' }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 404,
      code: null,
      resetAt: null,
      contact: null,
    });
  });

  it('reads a code, reset time or contact that is not a string as null', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 42, details: { reset_at: 1_760_000_000, contact: { email: 'support@haiwave.ai' } } } }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 429,
      code: null,
      resetAt: null,
      contact: null,
    });
  });

  it('a 200 that is not an event stream (an HTML sign-in page) → http_error with null fields', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html><title>Sign in</title>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 200,
      code: null,
      resetAt: null,
      contact: null,
    });
  });

  it('a 200 event stream with no body → http_error with null fields', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 200,
      code: null,
      resetAt: null,
      contact: null,
    });
  });

  it('a 200 with no content type → http_error, its body not read as events', async () => {
    const enc = new TextEncoder();
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(enc.encode(ev('meta', META) + ev('done', DONE)));
            c.close();
          },
        }),
        { status: 200 },
      ),
    );
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 200,
      code: null,
      resetAt: null,
      contact: null,
    });
  });

  it('an error status labelled as an event stream → http_error carrying the code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'MODEL_ERROR', message: 'x' } }), { status: 502, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }),
    );
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({
      kind: 'http_error',
      status: 502,
      code: 'MODEL_ERROR',
      resetAt: null,
      contact: null,
    });
  });

  it('a stream that ends without done/error → network_error', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('delta', { text: 'partial' })]));
    expect((await postHelpMessage(REQ, callbacks(), new AbortController().signal)).kind).toBe('network_error');
  });

  it('fetch rejects → network_error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await postHelpMessage(REQ, callbacks(), new AbortController().signal)).kind).toBe('network_error');
  });

  it('abort before the response → aborted', async () => {
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    const ac = new AbortController();
    const pending = postHelpMessage(REQ, callbacks(), ac.signal);
    ac.abort();
    expect(await pending).toEqual({ kind: 'aborted' });
  });

  it('ignores malformed events', async () => {
    fetchMock.mockResolvedValue(sse(['event: delta\ndata: not-json\n\n', ev('delta', { nope: 1 }), ev('delta', { text: 'ok' }), ev('done', DONE)]));
    const cb = callbacks();
    await postHelpMessage(REQ, cb, new AbortController().signal);
    expect(cb.onDelta.mock.calls.map((c) => c[0])).toEqual(['ok']);
  });

  it.each([
    ['meta', ev('meta', { ...META, conversation_id: 'not-a-uuid' })],
    ['done', ev('done', { ...DONE, usage: { input: -1, cached: 0, output: 0 } })],
    ['error', ev('error', { code: 'teapot', retryable: true })],
  ])('ignores a %s event that does not match its schema', async (_name, bad) => {
    fetchMock.mockResolvedValue(sse([bad]));
    const cb = callbacks();
    expect(await postHelpMessage(REQ, cb, new AbortController().signal)).toEqual({ kind: 'network_error' });
    expect(cb.onMeta).not.toHaveBeenCalled();
  });

  it('ignores every event after the terminal one, even in the same chunk', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META) + ev('done', DONE) + ev('delta', { text: 'late' }) + ev('error', { code: 'withheld', retryable: false })]));
    const cb = callbacks();
    expect(await postHelpMessage(REQ, cb, new AbortController().signal)).toEqual({ kind: 'done', done: DONE });
    expect(cb.onDelta).not.toHaveBeenCalled();
  });

  it('returns at the terminal event while the stream is still open', async () => {
    fetchMock.mockResolvedValue(openSse([ev('meta', META), ev('done', DONE)]));
    expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({ kind: 'done', done: DONE });
  });

  it('cancels the response stream once the terminal event is read', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(openSse([ev('meta', META), ev('done', DONE)], cancel));
    await postHelpMessage(REQ, callbacks(), new AbortController().signal);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  });

  it('a cancel that fails leaves no unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const cancel = vi.fn(() => {
        throw new Error('cancel failed');
      });
      fetchMock.mockResolvedValue(openSse([ev('meta', META), ev('done', DONE)], cancel));
      expect(await postHelpMessage(REQ, callbacks(), new AbortController().signal)).toEqual({ kind: 'done', done: DONE });
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('a stream that fails mid-answer → network_error, after the parts already read', async () => {
    fetchMock.mockResolvedValue(failingSse([ev('meta', META), ev('delta', { text: 'partial' })], new TypeError('network error')));
    const cb = callbacks();
    expect(await postHelpMessage(REQ, cb, new AbortController().signal)).toEqual({ kind: 'network_error' });
    expect(cb.onDelta.mock.calls.map((c) => c[0])).toEqual(['partial']);
  });

  it('abort mid-answer, the body failing with the abort → aborted', async () => {
    fetchMock.mockImplementation((_u: string, init: RequestInit) => Promise.resolve(abortableSse([ev('meta', META)], init.signal as AbortSignal, 'error')));
    const ac = new AbortController();
    const cb = callbacks();
    const pending = postHelpMessage(REQ, cb, ac.signal);
    await vi.waitFor(() => expect(cb.onMeta).toHaveBeenCalled());
    ac.abort();
    expect(await pending).toEqual({ kind: 'aborted' });
  });

  it('abort mid-answer, the body closing without a terminal event → aborted', async () => {
    fetchMock.mockImplementation((_u: string, init: RequestInit) => Promise.resolve(abortableSse([ev('meta', META)], init.signal as AbortSignal, 'close')));
    const ac = new AbortController();
    const cb = callbacks();
    const pending = postHelpMessage(REQ, cb, ac.signal);
    await vi.waitFor(() => expect(cb.onMeta).toHaveBeenCalled());
    ac.abort();
    expect(await pending).toEqual({ kind: 'aborted' });
  });

  it('abort while an error body is still arriving → aborted, not an http_error with its fields lost', async () => {
    const enc = new TextEncoder();
    let bodyRead = false;
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(enc.encode('{"error":{"code":"RATE_LIMIT_'));
              // As a browser's fetch body does: an abort after the headers fails the body that is still readable.
              init.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
            },
            pull() {
              bodyRead = true; // the first chunk has been taken by the reader
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const ac = new AbortController();
    const pending = postHelpMessage(REQ, callbacks(), ac.signal);
    await vi.waitFor(() => expect(bodyRead).toBe(true));
    ac.abort();
    expect(await pending).toEqual({ kind: 'aborted' });
  });
});

describe('useHelpStream', () => {
  it('aborts the in-flight request on unmount', async () => {
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: RequestInit) => {
      seen = init.signal ?? undefined;
      return new Promise(() => undefined);
    });
    const { result, unmount } = renderHook(() => useHelpStream());
    void result.current.send(REQ, callbacks());
    await vi.waitFor(() => expect(seen).toBeDefined());
    unmount();
    expect(seen?.aborted).toBe(true);
  });

  it('stop() aborts the request and send resolves aborted', async () => {
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    const { result } = renderHook(() => useHelpStream());
    const pending = result.current.send(REQ, callbacks());
    result.current.stop();
    await expect(pending).resolves.toEqual({ kind: 'aborted' });
  });

  it('a second send aborts the first, so one request runs at a time', async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_u: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    });
    const { result } = renderHook(() => useHelpStream());
    const first = result.current.send(REQ, callbacks());
    void result.current.send(REQ, callbacks());
    expect(signals.map((s) => s.aborted)).toEqual([true, false]);
    await expect(first).resolves.toEqual({ kind: 'aborted' });
  });

  it('stop() after a superseded send has settled still aborts the newer request', async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_u: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    });
    const { result } = renderHook(() => useHelpStream());
    const first = result.current.send(REQ, callbacks());
    const second = result.current.send(REQ, callbacks());
    await expect(first).resolves.toEqual({ kind: 'aborted' });
    result.current.stop();
    expect(signals[1].aborted).toBe(true);
    await expect(second).resolves.toEqual({ kind: 'aborted' });
  });

  it('returns the same send and stop on every render', () => {
    const { result, rerender } = renderHook(() => useHelpStream());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.send).toBe(first.send);
    expect(result.current.stop).toBe(first.stop);
  });

  it('a re-render while a request runs leaves it running, and stop() still reaches it', async () => {
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: RequestInit) => {
      seen = init.signal ?? undefined;
      return new Promise(() => undefined);
    });
    const { result, rerender } = renderHook(() => useHelpStream());
    void result.current.send(REQ, callbacks());
    await vi.waitFor(() => expect(seen).toBeDefined());
    rerender();
    expect(seen?.aborted).toBe(false);
    result.current.stop();
    expect(seen?.aborted).toBe(true);
  });

  it('send streams to the caller’s callbacks and resolves with the outcome, posting the body it was given', async () => {
    fetchMock.mockResolvedValue(sse([ev('meta', META), ev('delta', { text: 'Hello ' }), ev('delta', { text: 'there' }), ev('done', DONE)]));
    const { result } = renderHook(() => useHelpStream());
    const cb = callbacks();
    const body = { ...REQ, conversation_id: CONV, language: 'ko' as const };
    expect(await result.current.send(body, cb)).toEqual({ kind: 'done', done: DONE });
    expect(cb.onMeta).toHaveBeenCalledWith(META);
    expect(cb.onDelta.mock.calls.map((c) => c[0])).toEqual(['Hello ', 'there']);
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual(body);
  });
});
