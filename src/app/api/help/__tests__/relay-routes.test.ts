// @vitest-environment node
// src/app/api/help/__tests__/relay-routes.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken } = vi.hoisted(() => ({ getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken }));
vi.mock('@/lib/help/served-guide', () => ({ readServedGuide: vi.fn(async () => ({ guideSha: null, agentVersion: null })) }));

import { POST as FEEDBACK } from '../messages/[id]/feedback/route';
import { POST as CASE_SUMMARY } from '../conversations/[id]/case-summary/route';
import { readServedGuide } from '@/lib/help/served-guide';

const MSG = 'b5d4c3a2-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const fetchMock = vi.fn();
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, body?: string) => new NextRequest(url, { method: 'POST', body, headers: body ? { 'content-type': 'application/json' } : undefined });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HELP_AGENT_ENABLED = 'true';
  getSession.mockResolvedValue({ participant: { id: 'participant-1' }, is_admin: false });
  getToken.mockResolvedValue('header.payload.signature');
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  delete process.env.HELP_AGENT_ENABLED;
  vi.unstubAllGlobals();
});

describe('POST /api/help/messages/[id]/feedback', () => {
  it('404 while the flag is off', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    expect((await FEEDBACK(req('http://localhost/x', '{}'), ctx(MSG))).status).toBe(404);
  });

  it('400 for a non-UUID id, without calling haiCore', async () => {
    const res = await FEEDBACK(req('http://localhost/x', '{"rating":"up"}'), ctx('../../admin'));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the rating and relays 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await FEEDBACK(req('http://localhost/x', '{"rating":"down","note":"wrong page"}'), ctx(MSG));
    expect(res.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/api/v1/help/messages/${MSG}/feedback$`));
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"rating":"down","note":"wrong page"}');
  });

  it('relays haiCore 404 MESSAGE_NOT_FOUND', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'MESSAGE_NOT_FOUND' } }), { status: 404, headers: { 'content-type': 'application/json' } }));
    const res = await FEEDBACK(req('http://localhost/x', '{"rating":"up"}'), ctx(MSG));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'MESSAGE_NOT_FOUND' } });
  });

  it('502 when haiCore is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect((await FEEDBACK(req('http://localhost/x', '{"rating":"up"}'), ctx(MSG))).status).toBe(502);
  });

  // Contract C.1 puts the served-guide headers on POST /help/messages only, so the
  // other help routes do not read the two files (`served` is opt-in on helpUpstream).
  it('does not read the served guide: only a help question carries the served-guide headers', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await FEEDBACK(req('http://localhost/x', '{"rating":"up"}'), ctx(MSG));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readServedGuide).not.toHaveBeenCalled();
  });
});

describe('POST /api/help/conversations/[id]/case-summary', () => {
  it('404 while the flag is off, without calling haiCore', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    expect((await CASE_SUMMARY(req('http://localhost/x'), ctx(CONV))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 for a non-UUID id, without calling haiCore', async () => {
    const res = await CASE_SUMMARY(req('http://localhost/x'), ctx('../../admin'));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards and relays the summary', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ summary: 'Problem: …', contact: 'support@haiwave.ai' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await CASE_SUMMARY(req('http://localhost/x'), ctx(CONV));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: 'Problem: …', contact: 'support@haiwave.ai' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/api/v1/help/conversations/${CONV}/case-summary$`));
    expect(init.method).toBe('POST');
  });

  // haiCore (Fastify) answers 400 to an empty body that is labelled application/json,
  // so a request with no body must not carry the JSON content type.
  it('sends no body and no Content-Type', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ summary: 'Problem: …', contact: 'support@haiwave.ai' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await CASE_SUMMARY(req('http://localhost/x'), ctx(CONV));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it.each([
    [503, 'NO_ACTIVE_PACK'],
    [404, 'CONVERSATION_NOT_FOUND'],
    [502, 'MODEL_ERROR'],
  ])('relays haiCore %i %s verbatim', async (status, code) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status, headers: { 'content-type': 'application/json' } }));
    const res = await CASE_SUMMARY(req('http://localhost/x'), ctx(CONV));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code } });
  });

  it('502 when haiCore is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect((await CASE_SUMMARY(req('http://localhost/x'), ctx(CONV))).status).toBe(502);
  });
});
