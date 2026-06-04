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

const url = (qs = '') => `http://localhost/api/admin/registration-requests${qs}`;
const get = (qs = '') => GET(new NextRequest(url(qs)));

describe('GET /api/admin/registration-requests (BFF list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ requests: [{ id: 'r1' }] }), {
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

  it('403 when the session is not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await get()).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('401 when there is no JWT-like token', async () => {
    getToken.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards status + risk_tier query and Bearer token, returns the JSON', async () => {
    const res = await get('?status=pending_approval&risk_tier=blocked');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ requests: [{ id: 'r1' }] });
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/registration-requests?');
    expect(calledUrl).toContain('status=pending_approval');
    expect(calledUrl).toContain('risk_tier=blocked');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    );
  });

  it('passes a haiCore error status through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })));
    expect((await get()).status).toBe(502);
  });

  it('forwards a haiCore-compatible protocol version header (not the stale 1.0.0)', async () => {
    await get();
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = (init.headers as Record<string, string>)['X-HaiWave-Protocol-Version'];
    // haiCore rejects mismatched MAJOR versions; the server is on PROTOCOL_VERSION.
    expect(sent).toBe(PROTOCOL_VERSION);
  });
});
