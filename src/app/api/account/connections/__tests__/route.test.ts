import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { requestConnection, getSession, getToken } = vi.hoisted(() => ({
  requestConnection: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ requestConnection }),
}));

import { POST } from '../route';

const url = 'http://localhost/api/account/connections';
const post = (body: unknown) =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });

describe('POST /api/account/connections', () => {
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
    expect((await post({ target_participant_id: 'p-2' })).status).toBe(401);
    expect(requestConnection).not.toHaveBeenCalled();
  });

  it('400 when target_participant_id is missing', async () => {
    expect((await post({})).status).toBe(400);
    expect(requestConnection).not.toHaveBeenCalled();
  });

  it('201 with the real haiCore result on success', async () => {
    requestConnection.mockResolvedValue({ id: 'req-1', status: 'pending' });
    const res = await post({ target_participant_id: 'p-2', message: 'hi' });
    expect(res.status).toBe(201);
    expect(requestConnection).toHaveBeenCalledWith('p-2', { message: 'hi' });
    expect(await res.json()).toEqual({ id: 'req-1', status: 'pending' });
  });

  // Regression pin: a non-JWT cookie must never fabricate a 201 "pending"
  // connection request — fail closed with 401.
  it('401 (no fake success) when the token is not JWT-like', async () => {
    getToken.mockResolvedValue('mock-cookie'); // not JWT-like (no dots)
    const res = await post({ target_participant_id: 'p-2' });
    expect(res.status).toBe(401);
    expect(requestConnection).not.toHaveBeenCalled();
  });

  it('propagates a haiCore 4xx verbatim instead of collapsing to 500', async () => {
    requestConnection.mockRejectedValue(
      Object.assign(new Error('already connected'), {
        status: 409,
        haiCoreBody: { error: 'already connected', code: 'ALREADY_CONNECTED' },
      }),
    );
    const res = await post({ target_participant_id: 'p-2' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already connected', code: 'ALREADY_CONNECTED' });
  });
});
