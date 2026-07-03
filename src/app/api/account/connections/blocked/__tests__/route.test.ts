import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { blockParticipant, getSession, getToken } = vi.hoisted(() => ({
  blockParticipant: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ blockParticipant }),
}));

import { POST } from '../route';

const url = 'http://localhost/api/account/connections/blocked';
const post = (body: unknown) =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });

describe('POST /api/account/connections/blocked', () => {
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
    expect(blockParticipant).not.toHaveBeenCalled();
  });

  it('400 when target_participant_id is missing', async () => {
    expect((await post({})).status).toBe(400);
    expect(blockParticipant).not.toHaveBeenCalled();
  });

  it('201 with the real haiCore result on success', async () => {
    blockParticipant.mockResolvedValue({ success: true });
    const res = await post({ target_participant_id: 'p-2' });
    expect(res.status).toBe(201);
    expect(blockParticipant).toHaveBeenCalledWith('p-2');
    expect(await res.json()).toEqual({ success: true });
  });

  // Regression pin: a non-JWT cookie (dev shim, or a poisoned/misconfigured
  // cookie in prod) must never fabricate a 201 "blocked" — it must fail
  // closed with 401, same as every other withHaiCore mutation route.
  it('401 (no fake success) when the token is not JWT-like', async () => {
    getToken.mockResolvedValue('mock-cookie'); // not JWT-like (no dots)
    const res = await post({ target_participant_id: 'p-2' });
    expect(res.status).toBe(401);
    expect(blockParticipant).not.toHaveBeenCalled();
  });

  it('propagates a haiCore 4xx verbatim instead of collapsing to 500', async () => {
    blockParticipant.mockRejectedValue(
      Object.assign(new Error('already blocked'), {
        status: 409,
        haiCoreBody: { error: 'already blocked', code: 'ALREADY_BLOCKED' },
      }),
    );
    const res = await post({ target_participant_id: 'p-2' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already blocked', code: 'ALREADY_BLOCKED' });
  });
});
