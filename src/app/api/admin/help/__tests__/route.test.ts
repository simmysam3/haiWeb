// src/app/api/admin/help/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

const { getSession, getToken } = vi.hoisted(() => ({ getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken }));

import { GET as LIST } from '../conversations/route';
import { GET as DETAIL } from '../conversations/[id]/route';

const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const fetchMock = vi.fn();
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HELP_AGENT_ENABLED = 'true';
  getSession.mockResolvedValue({ is_admin: true });
  getToken.mockResolvedValue('header.payload.signature');
  fetchMock.mockResolvedValue(json(200, { items: [], next_cursor: null }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  delete process.env.HELP_AGENT_ENABLED;
  vi.unstubAllGlobals();
});

describe('GET /api/admin/help/conversations', () => {
  it('404 while the flag is off', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    expect((await LIST(new NextRequest('http://localhost/api/admin/help/conversations'))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('403 for a non-admin (requireAdminToken)', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await LIST(new NextRequest('http://localhost/api/admin/help/conversations'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the query through with the admin Bearer and protocol header', async () => {
    const res = await LIST(new NextRequest('http://localhost/api/admin/help/conversations?thumbs_down=true&language=ko&page_size=50'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], next_cursor: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/admin\/help\/conversations\?thumbs_down=true&language=ko&page_size=50$/);
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer header.payload.signature');
    expect(h['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
  });

  it('relays a haiCore failure status', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const res = await LIST(new NextRequest('http://localhost/api/admin/help/conversations'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'haiCore 500' });
  });

  it('sends no query string when the request has none', async () => {
    await LIST(new NextRequest('http://localhost/api/admin/help/conversations'));
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/\/api\/v1\/admin\/help\/conversations$/);
  });

  it('502 when haiCore cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await LIST(new NextRequest('http://localhost/api/admin/help/conversations'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to reach haiCore' });
  });

  it('relays the list body as haiCore sent it', async () => {
    const body = {
      items: [{ conversation_id: CONV, participant_id: '11111111-1111-1111-1111-111111111111', participant_name: 'Acme Corp', user_sub: 'kc-user-1', language: 'ko', started_at: '2026-10-07T10:00:00.000Z', last_message_at: '2026-10-07T10:05:00.000Z', message_count: 2, thumbs_down_count: 1, flags: ['served_mismatch'] }],
      next_cursor: 'cur-2',
    };
    fetchMock.mockResolvedValue(json(200, body));
    const res = await LIST(new NextRequest('http://localhost/api/admin/help/conversations'));
    expect(await res.json()).toEqual(body);
  });

  it.each([
    ['a non-admin', { is_admin: false }],
    ['no session', null],
  ])('404 while the flag is off, before any session read, for %s', async (_who, session) => {
    delete process.env.HELP_AGENT_ENABLED;
    getSession.mockResolvedValue(session);
    expect((await LIST(new NextRequest('http://localhost/api/admin/help/conversations'))).status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads from the configured haiCore host', async () => {
    const before = process.env.HAIWAVE_API_URL;
    process.env.HAIWAVE_API_URL = 'http://core.example.test:7000';
    try {
      await LIST(new NextRequest('http://localhost/api/admin/help/conversations'));
    } finally {
      if (before === undefined) delete process.env.HAIWAVE_API_URL;
      else process.env.HAIWAVE_API_URL = before;
    }
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('http://core.example.test:7000/api/v1/admin/help/conversations');
  });
});

describe('GET /api/admin/help/conversations/[id]', () => {
  it('400 for a non-UUID id', async () => {
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches and relays the detail', async () => {
    fetchMock.mockResolvedValue(json(200, { conversation_id: CONV, messages: [] }));
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(new RegExp(`/api/v1/admin/help/conversations/${CONV}$`));
  });

  it('404 while the flag is off', async () => {
    delete process.env.HELP_AGENT_ENABLED;
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('403 for a non-admin (requireAdminToken)', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the admin Bearer and protocol header', async () => {
    await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    const h = (fetchMock.mock.calls[0] as [string, RequestInit])[1]?.headers as Record<string, string> | undefined;
    expect(h?.Authorization).toBe('Bearer header.payload.signature');
    expect(h?.['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
  });

  it('relays a haiCore refusal status', async () => {
    fetchMock.mockResolvedValue(json(404, { error: { code: 'CONVERSATION_NOT_FOUND', message: 'not found' } }));
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'haiCore 404' });
  });

  it('502 when haiCore cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to reach haiCore' });
  });

  it('relays the detail body as haiCore sent it', async () => {
    const body = { conversation_id: CONV, messages: [], packs: [{ version: '2026-10-07.1' }] };
    fetchMock.mockResolvedValue(json(200, body));
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: CONV }) });
    expect(await res.json()).toEqual(body);
  });

  it.each([
    ['a non-admin', { is_admin: false }, CONV],
    ['no session', null, CONV],
    ['an admin with a non-UUID id', { is_admin: true }, 'nope'],
  ])('404 while the flag is off, before any session read or id check, for %s', async (_who, session, id) => {
    delete process.env.HELP_AGENT_ENABLED;
    getSession.mockResolvedValue(session);
    const res = await DETAIL(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
