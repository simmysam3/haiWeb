import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';

const { getSession, getToken } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken }));

import { POST } from '../route';

const url = 'http://localhost/api/admin/registration-requests/req-1/resend-invite';
const post = (id = 'req-1') =>
  POST(new NextRequest(url, { method: 'POST' }), { params: Promise.resolve({ id }) });

describe('POST /api/admin/registration-requests/:id/resend-invite (BFF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: true, last_invite_sent_at: '2026-10-05T21:40:00.000Z' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
  });

  it('401 when unauthenticated, and haiCore is not called', async () => {
    getSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('403 when not admin, and haiCore is not called', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await post()).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards a bodyless-by-contract POST to haiCore with Bearer, the protocol header and body {}, and returns the 200 body verbatim', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, last_invite_sent_at: '2026-10-05T21:40:00.000Z' });
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/registration-requests/req-1/resend-invite');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer header.payload.signature');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-HaiWave-Protocol-Version']).toBe(PROTOCOL_VERSION);
  });

  it.each([
    [409, { error: { code: 'user_has_credentials' } }],
    [
      429,
      {
        error: {
          code: 'invite_cooldown_active',
          details: { last_invite_sent_at: '2026-10-05T21:40:00.000Z', retry_after_seconds: 300 },
        },
      },
    ],
  ])('passes the %s refusal body through verbatim', async (status, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const res = await post();
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it('keeps the upstream status when its body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>bad gateway</html>', { status: 504 })));
    const res = await post();
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({});
  });

  it('502 { error: "Failed to reach haiCore" } when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await post();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to reach haiCore' });
  });

  it('encodes the id into the haiCore path', async () => {
    await post('a/b?c');
    const [calledUrl] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/registration-requests/a%2Fb%3Fc/resend-invite');
  });
});
