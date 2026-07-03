import { afterEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { get: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const jwtVerify = vi.fn();
vi.mock('jose', () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import { getSession } from '../auth';

function portalCookie() {
  cookieStore.get.mockReturnValue({ value: 'header.body.sig' });
}

afterEach(() => {
  cookieStore.get.mockReset();
  jwtVerify.mockReset();
});

describe('getSession() rejects tokens not issued to the portal client', () => {
  it('accepts a token whose azp is the portal client', async () => {
    portalCookie();
    jwtVerify.mockResolvedValue({
      payload: { sub: 'u-1', azp: 'haiwave-portal', realm_access: { roles: ['account_owner'] } },
    });
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe('u-1');
  });

  it('rejects a same-realm agent token (different azp, no matching aud)', async () => {
    portalCookie();
    jwtVerify.mockResolvedValue({
      payload: { sub: 'agent-1', azp: 'demo-agent', aud: 'account', realm_access: { roles: ['account_owner'] } },
    });
    expect(await getSession()).toBeNull();
  });

  it('accepts a token whose aud contains the portal client even if azp is absent', async () => {
    portalCookie();
    jwtVerify.mockResolvedValue({
      payload: { sub: 'u-2', aud: ['haiwave-portal', 'account'], realm_access: { roles: [] } },
    });
    expect(await getSession()).not.toBeNull();
  });
});
