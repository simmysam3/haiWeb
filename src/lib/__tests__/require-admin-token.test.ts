import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const getSession = vi.fn();
const getToken = vi.fn();
vi.mock('../auth', () => ({
  getSession: () => getSession(),
  getToken: () => getToken(),
  hasRole: () => true,
}));

import { requireAdminToken } from '../with-hai-core';

afterEach(() => {
  getSession.mockReset();
  getToken.mockReset();
});

describe('requireAdminToken', () => {
  it('401s when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const r = await requireAdminToken();
    expect(r).toBeInstanceOf(NextResponse);
    expect((r as NextResponse).status).toBe(401);
  });

  it('403s when the session is not admin', async () => {
    getSession.mockResolvedValue({ is_admin: false });
    expect(((await requireAdminToken()) as NextResponse).status).toBe(403);
  });

  it('401s when the token is not JWT-like', async () => {
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('not-a-jwt');
    expect(((await requireAdminToken()) as NextResponse).status).toBe(401);
  });

  it('returns the token for an admin with a JWT', async () => {
    getSession.mockResolvedValue({ is_admin: true });
    getToken.mockResolvedValue('header.body.sig');
    expect(await requireAdminToken()).toEqual({ token: 'header.body.sig' });
  });
});
