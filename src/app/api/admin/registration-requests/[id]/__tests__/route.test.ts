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

const url = 'http://localhost/api/admin/registration-requests/req-1';
const get = (id = 'req-1') =>
  GET(new NextRequest(url), { params: Promise.resolve({ id }) });

describe('GET /api/admin/registration-requests/:id (BFF detail)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ request: { id: 'req-1', risk_tier: 'blocked' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('403 when not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await get()).status).toBe(403);
  });

  it('401 with no JWT-like token', async () => {
    getToken.mockResolvedValue('mock-cookie'); // no dots → not JWT-like
    expect((await get()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches the detail by id with Bearer token and returns the JSON', async () => {
    const res = await get('req-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ request: { id: 'req-1', risk_tier: 'blocked' } });
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/registration-requests/req-1');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    );
    expect((init.headers as Record<string, string>)['X-HaiWave-Protocol-Version']).toBe(
      PROTOCOL_VERSION,
    );
  });

  it('passes a haiCore 404 through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));
    expect((await get('nope')).status).toBe(404);
  });
});
