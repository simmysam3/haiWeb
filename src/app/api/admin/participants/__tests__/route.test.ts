import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

const { getSession, getToken } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken }));

import { GET } from '../route';

const LIST = { participants: [{ participant_id: 'p1', legal_name: 'Real Co', status: 'active' }], total_count: 1 };

describe('GET /api/admin/participants (BFF list proxy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(LIST), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('403 when the session is not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await GET()).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('proxies to haiCore /admin/participants with Bearer + protocol header and returns the JSON', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(LIST);
    const [calledUrl, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toMatch(/\/api\/v1\/admin\/participants$/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer header.payload.signature');
    expect(headers['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
  });

  it('passes an upstream error status through, never fabricating data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it('502 when haiCore is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
