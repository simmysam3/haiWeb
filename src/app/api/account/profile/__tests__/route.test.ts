import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({
  fetchRaw: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ fetchRaw }),
}));

import { PUT } from '../route';

const url = 'http://localhost/api/account/profile';
const put = (body: unknown) =>
  PUT(new NextRequest(url, { method: 'PUT', body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('PUT /api/account/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature'); // JWT-like → real client path
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    expect((await put({ legal_name: 'Acme' })).status).toBe(401);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('200 with the real haiCore body on success, calling fetchRaw with PUT + the participant profile path', async () => {
    fetchRaw.mockResolvedValue(jsonResponse({ legal_name: 'Acme Corp' }));
    const res = await put({ legal_name: 'Acme Corp' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ legal_name: 'Acme Corp' });
    const [path, init] = fetchRaw.mock.calls[0];
    expect(path).toBe('/company/p-self/profile');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ legal_name: 'Acme Corp' });
  });

  // Regression pin: a non-JWT cookie must never echo the request body back as
  // a fabricated success — fail closed with 401.
  it('401 (no fake echo) when the token is not JWT-like', async () => {
    getToken.mockResolvedValue('mock-cookie'); // not JWT-like (no dots)
    const res = await put({ legal_name: 'Acme Corp' });
    expect(res.status).toBe(401);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('propagates a non-OK haiCore status verbatim', async () => {
    fetchRaw.mockResolvedValue(new Response('bad request', { status: 400 }));
    const res = await put({ legal_name: '' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad request' });
  });
});
