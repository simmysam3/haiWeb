// src/components/help/use-help-stream.ts
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  HelpDeltaEventSchema,
  HelpDoneEventSchema,
  HelpErrorEventSchema,
  HelpMetaEventSchema,
  type HelpDoneEvent,
  type HelpErrorEvent,
  type HelpMessageRequest,
  type HelpMetaEvent,
} from '@haiwave/protocol';
import { createSseParser } from './parse-sse';

export const HELP_MESSAGES_ENDPOINT = '/api/help/messages';

export interface HelpStreamCallbacks {
  onMeta(meta: HelpMetaEvent): void;
  onDelta(text: string): void;
}

export type HelpSendOutcome =
  | { kind: 'done'; done: HelpDoneEvent }
  | { kind: 'stream_error'; error: HelpErrorEvent }
  | { kind: 'http_error'; status: number; code: string | null; resetAt: string | null; contact: string | null }
  | { kind: 'session_expired' }
  | { kind: 'network_error' }
  | { kind: 'aborted' };

interface ErrorFields {
  code: string | null;
  resetAt: string | null;
  contact: string | null;
}

/** haiCore errors are `{ error: { code, details } }`; BFF-originated ones are `{ error: string }`. */
async function readErrorFields(res: Response): Promise<ErrorFields> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body.error && typeof body.error === 'object') {
      const e = body.error as { code?: unknown; details?: { reset_at?: unknown; contact?: unknown } };
      return {
        code: typeof e.code === 'string' ? e.code : null,
        resetAt: typeof e.details?.reset_at === 'string' ? e.details.reset_at : null,
        contact: typeof e.details?.contact === 'string' ? e.details.contact : null,
      };
    }
  } catch {
    // Non-JSON error body.
  }
  return { code: null, resetAt: null, contact: null };
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export async function postHelpMessage(body: HelpMessageRequest, cb: HelpStreamCallbacks, signal: AbortSignal): Promise<HelpSendOutcome> {
  let res: Response;
  try {
    res = await fetch(HELP_MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return signal.aborted ? { kind: 'aborted' } : { kind: 'network_error' };
  }

  if (res.status === 401) return { kind: 'session_expired' };
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.startsWith('text/event-stream') || !res.body) {
    return { kind: 'http_error', status: res.status, ...(await readErrorFields(res)) };
  }

  const result: { terminal: HelpSendOutcome | null } = { terminal: null };
  const parser = createSseParser(({ event, data }) => {
    if (result.terminal) return;
    const payload = parseJson(data);
    if (event === 'meta') {
      const p = HelpMetaEventSchema.safeParse(payload);
      if (p.success) cb.onMeta(p.data);
    } else if (event === 'delta') {
      const p = HelpDeltaEventSchema.safeParse(payload);
      if (p.success) cb.onDelta(p.data.text);
    } else if (event === 'done') {
      const p = HelpDoneEventSchema.safeParse(payload);
      if (p.success) result.terminal = { kind: 'done', done: p.data };
    } else if (event === 'error') {
      const p = HelpErrorEventSchema.safeParse(payload);
      if (p.success) result.terminal = { kind: 'stream_error', error: p.data };
    }
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (!result.terminal) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
  } catch {
    return signal.aborted ? { kind: 'aborted' } : { kind: 'network_error' };
  }
  parser.end();
  if (result.terminal) {
    void reader.cancel().catch(() => undefined);
    return result.terminal;
  }
  // The stream closed without done/error: the connection broke mid-answer.
  return signal.aborted ? { kind: 'aborted' } : { kind: 'network_error' };
}

/** One help request at a time; stop() and unmount abort it (Review Focus #5). */
export function useHelpStream(): {
  send(body: HelpMessageRequest, cb: HelpStreamCallbacks): Promise<HelpSendOutcome>;
  stop(): void;
} {
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(async (body: HelpMessageRequest, cb: HelpStreamCallbacks) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      return await postHelpMessage(body, cb, current.signal);
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }, []);

  const stop = useCallback(() => controller.current?.abort(), []);

  return useMemo(() => ({ send, stop }), [send, stop]);
}
