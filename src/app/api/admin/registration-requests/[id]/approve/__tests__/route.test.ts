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

const url = 'http://localhost/api/admin/registration-requests/req-1/approve';
const post = (body: unknown, id = 'req-1') =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe('POST /api/admin/registration-requests/:id/approve (BFF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: true, participant_id: 'p-9', status: 'approved' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    expect((await post({})).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('403 when not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await post({})).status).toBe(403);
  });

  it('forwards {override,reason} + Bearer and returns the success body', async () => {
    const res = await post({ override: true, reason: 'sanctions waiver on file' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, participant_id: 'p-9', status: 'approved' });
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/registration-requests/req-1/approve');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      override: true,
      reason: 'sanctions waiver on file',
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    );
    expect((init.headers as Record<string, string>)['X-HaiWave-Protocol-Version']).toBe(
      PROTOCOL_VERSION,
    );
  });

  it('passes the 409 blocked_requires_override body through verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'blocked_requires_override' } }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const res = await post({});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'blocked_requires_override' } });
  });
});
