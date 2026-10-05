// @vitest-environment node
// src/app/api/help/__tests__/relay-routes.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

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

  it.each([
    ['JSON with its own spacing', '{ "rating" : "up" }'],
    ['text that is not JSON', '{oops'],
  ])('forwards %s exactly as sent (haiCore validates it)', async (_what, body) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await FEEDBACK(req('http://localhost/x', body), ctx(MSG));
    expect(res.status).toBe(204);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(body);
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

// Task 3.4 review, round 1: each relay route splices its id into haiCore's URL, so only a
// whole UUID may get through; helpAuth's 401 stops it before haiCore; and only a help
// question carries the served-guide headers (contract C.1).
describe.each([
  ['feedback', MSG, (id: string) => FEEDBACK(req('http://localhost/x', '{"rating":"up"}'), ctx(id))],
  ['case summary', CONV, (id: string) => CASE_SUMMARY(req('http://localhost/x'), ctx(id))],
])('POST %s relay: the id, the auth gate and the headers', (_route, uuid, call) => {
  beforeEach(() => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
  });

  it.each([
    ['36 characters that are not a UUID', '../../../admin/help/packs/'.padEnd(36, 'a')],
    ['a UUID followed by a path', `${uuid}/x`],
    ['a UUID followed by a traversal', `${uuid}/../../../admin/help/packs`],
    ['a UUID followed by a query', `${uuid}?x=1`],
    ['a UUID followed by a line feed', `${uuid}\n`],
    ['a UUID after a space', ` ${uuid}`],
    ['a UUID without its hyphens', uuid.replace(/-/g, '')],
    ['an empty id', ''],
  ])('400 for %s, without calling haiCore', async (_what, id) => {
    const res = await call(id);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 without a session, without calling haiCore', async () => {
    getSession.mockResolvedValue(null);
    expect((await call(uuid)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 with a token that is not a JWT, without calling haiCore', async () => {
    getToken.mockResolvedValue('dev-placeholder');
    expect((await call(uuid)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the Bearer, participant and protocol headers, and no served-guide header', async () => {
    await call(uuid);
    const h = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer header.payload.signature');
    expect(h['x-haiwave-participant-id']).toBe('participant-1');
    expect(h['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
    expect(h).not.toHaveProperty('x-help-served-guide-sha');
    expect(h).not.toHaveProperty('x-help-served-agent-version');
    expect(readServedGuide).not.toHaveBeenCalled();
  });
});
