import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

const { getSession, getToken } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken }));

import { GET } from '../route';
import { GET as GET_EXPORT } from '../export/route';

const url = (qs = '') => `http://localhost/api/admin/chat-feedback${qs}`;
const get = (qs = '') => GET(new NextRequest(url(qs)));

const exportUrl = (qs = '') => `http://localhost/api/admin/chat-feedback/export${qs}`;
const getExport = (qs = '') => GET_EXPORT(new NextRequest(exportUrl(qs)));

describe('GET /api/admin/chat-feedback (BFF list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ events: [{ id: 'e1' }], total: 1, page: 1, page_size: 20 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
  });

  it('401 when unauthenticated (requireAdminToken gate short-circuits)', async () => {
    getSession.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('authed: fetches haiCore with same query string, Bearer token + protocol header, returns JSON', async () => {
    const res = await get('?rating=down&page=2');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [{ id: 'e1' }], total: 1, page: 1, page_size: 20 });

    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/chat-feedback?');
    expect(calledUrl).toContain('rating=down');
    expect(calledUrl).toContain('page=2');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    );
    expect((init.headers as Record<string, string>)['X-HaiWave-Protocol-Version']).toBe(
      PROTOCOL_VERSION,
    );
  });

  it('haiCore 500 → response status 500 with { error }', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'haiCore 500' });
  });
});

describe('GET /api/admin/chat-feedback/export (BFF JSONL export)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('authed: streams body with content-type + content-disposition passthrough', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('{"id":"e1"}\n', {
          status: 200,
          headers: {
            'content-type': 'application/x-ndjson',
            'content-disposition': 'attachment; filename="chat-feedback_2026-07-10.jsonl"',
          },
        }),
      ),
    );

    const res = await getExport();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-ndjson');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="chat-feedback_2026-07-10.jsonl"',
    );
    expect(await res.text()).toBe('{"id":"e1"}\n');
  });
});
