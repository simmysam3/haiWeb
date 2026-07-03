import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshToken, endSession, updateUserRole, disableUser, createUser, sendExecuteActionsEmail } from '../keycloak';

describe('keycloak token endpoints send client_secret (confidential client)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refreshToken includes client_secret in the body', async () => {
    await refreshToken('rt');
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.has('client_secret')).toBe(true);
  });

  it('endSession includes client_secret in the body', async () => {
    await endSession('rt');
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.has('client_secret')).toBe(true);
  });
});

describe('keycloak admin mutations surface Keycloak failures', () => {
  // URL-routed mock so the module-level admin-token cache cannot desync call order.
  function routedFetch(overrides: (url: string) => Response | undefined) {
    return vi.fn(async (url: string) => {
      const u = String(url);
      const override = overrides(u);
      if (override) return override;
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      return { ok: true, json: async () => ({ id: 'r1', name: 'account_admin' }), text: async () => '' } as unknown as Response;
    });
  }
  afterEach(() => vi.unstubAllGlobals());

  it('updateUserRole throws when the realm role-mapping assignment fails', async () => {
    vi.stubGlobal('fetch', routedFetch((u) =>
      u.includes('/role-mappings/realm')
        ? ({ ok: false, status: 500, text: async () => 'boom' } as unknown as Response)
        : undefined,
    ));
    await expect(updateUserRole('u1', 'account_admin')).rejects.toThrow();
  });

  it('updateUserRole throws when the role lookup fails', async () => {
    vi.stubGlobal('fetch', routedFetch((u) =>
      u.match(/\/roles\/[^/]+$/)
        ? ({ ok: false, status: 404, text: async () => 'no role' } as unknown as Response)
        : undefined,
    ));
    await expect(updateUserRole('u1', 'nonexistent')).rejects.toThrow();
  });

  it('disableUser throws when the disable PUT fails', async () => {
    vi.stubGlobal('fetch', routedFetch((u) =>
      u.match(/\/users\/[^/]+$/)
        ? ({ ok: false, status: 500, text: async () => 'nope' } as unknown as Response)
        : undefined,
    ));
    await expect(disableUser('u1')).rejects.toThrow();
  });
});

describe('invited-user identity assurance (IA-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('createUser does not auto-verify email or set a permanent inviter password', async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (u.endsWith('/users')) {
        sent = JSON.parse(String(init?.body));
        return { ok: true, headers: { get: (k: string) => (k === 'Location' ? '/admin/realms/x/users/u-new' : null) }, text: async () => '' } as unknown as Response;
      }
      return { ok: true, text: async () => '' } as unknown as Response;
    }));

    const id = await createUser({ email: 'a@b.com', firstName: 'A', lastName: 'B', attributes: {} });
    expect(id).toBe('u-new');
    expect(sent.emailVerified).toBe(false);
    const creds = (sent.credentials as Array<{ type: string; temporary?: boolean }> | undefined) ?? [];
    expect(creds.some((c) => c.type === 'password' && c.temporary === false)).toBe(false);
  });

  it('sendExecuteActionsEmail PUTs the requested actions to the user', async () => {
    let method = '', url = '', body: unknown;
    vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
      const s = String(u);
      if (s.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      url = s; method = String(init?.method); body = JSON.parse(String(init?.body));
      return { ok: true, text: async () => '' } as unknown as Response;
    }));

    await sendExecuteActionsEmail('u-1', ['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
    expect(method).toBe('PUT');
    expect(url).toContain('/users/u-1/execute-actions-email');
    expect(body).toEqual(['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
  });

  it('sendExecuteActionsEmail throws when Keycloak rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const s = String(u);
      if (s.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      return { ok: false, status: 500, text: async () => 'smtp down' } as unknown as Response;
    }));
    await expect(sendExecuteActionsEmail('u-1', ['VERIFY_EMAIL'])).rejects.toThrow();
  });
});
