import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSession, getToken }));

import { POST } from '../route';

const url = 'http://localhost/api/admin/registration-requests/req-1/reject';
const post = (body: unknown, id = 'req-1') =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe('POST /api/admin/registration-requests/:id/reject (BFF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, status: 'rejected' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    expect((await post({ reason: 'x' })).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('403 when not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect((await post({ reason: 'x' })).status).toBe(403);
  });

  it('400 when reason is missing or blank (does not call haiCore)', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ reason: '   ' })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards {reason} + Bearer and returns the success body', async () => {
    const res = await post({ reason: 'incomplete documentation' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'rejected' });
    const [calledUrl, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain('/api/v1/admin/registration-requests/req-1/reject');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'incomplete documentation' });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer header.payload.signature',
    );
  });
});
