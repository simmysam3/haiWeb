import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshToken, endSession, updateUserRole, disableUser, createUser, sendExecuteActionsEmail, listUsers } from '../keycloak';

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
    return vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const override = overrides(u);
      if (override) return override;
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (u.endsWith('/role-mappings/realm') && (init?.method ?? 'GET') === 'GET') {
        return { ok: true, json: async () => [], text: async () => '' } as unknown as Response;
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

describe('updateUserRole — the realm role is the single source of truth (D-212)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('removes the other assignable realm roles before adding the new one', async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      calls.push({ method, url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (u.match(/\/roles\/[^/]+$/)) {
        const name = u.split('/roles/')[1];
        return { ok: true, json: async () => ({ id: `id-${name}`, name }), text: async () => '' } as unknown as Response;
      }
      if (u.endsWith('/users/u1/role-mappings/realm') && method === 'GET') {
        return {
          ok: true,
          json: async () => [
            { id: 'id-account_admin', name: 'account_admin' },
            { id: 'id-default', name: 'default-roles-haiwave-network' },
          ],
          text: async () => '',
        } as unknown as Response;
      }
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' } as unknown as Response;
    }));

    await updateUserRole('u1', 'buyer_view_only');

    const mappingWrites = calls
      .filter((c) => c.url.endsWith('/users/u1/role-mappings/realm') && c.method !== 'GET')
      .map((c) => [c.method, (c.body as Array<{ name: string }>).map((r) => r.name)]);
    // The prior assignable role goes first; the realm's default composite role is left alone.
    expect(mappingWrites).toEqual([
      ['DELETE', ['account_admin']],
      ['POST', ['buyer_view_only']],
    ]);
  });

  it('returns the realm roles that govern after the change (a non-assignable role stays)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (u.match(/\/roles\/[^/]+$/)) {
        const name = u.split('/roles/')[1];
        return { ok: true, json: async () => ({ id: `id-${name}`, name }), text: async () => '' } as unknown as Response;
      }
      if (u.endsWith('/users/u-owner/role-mappings/realm') && method === 'GET') {
        return {
          ok: true,
          json: async () => [
            { id: 'id-account_owner', name: 'account_owner' },
            { id: 'id-procurement_transact', name: 'procurement_transact' },
            { id: 'id-default', name: 'default-roles-haiwave-network' },
          ],
          text: async () => '',
        } as unknown as Response;
      }
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' } as unknown as Response;
    }));

    const governing: string[] | void = await updateUserRole('u-owner', 'buyer_view_only');

    expect([...(governing ?? [])].sort()).toEqual(
      ['account_owner', 'buyer_view_only', 'default-roles-haiwave-network'].sort(),
    );
  });
});

describe('listUsers — the roster carries each user\'s realm roles (D-212)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('attaches each user\'s realm role-mappings as realmRoles', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (u.includes('/users?q=participant_id:p-apex')) {
        return {
          ok: true,
          json: async () => [
            { id: 'kc1', email: 'a@b.com', attributes: { role: ['account_admin'] } },
            { id: 'kc2', email: 'x@y.com' },
          ],
        } as unknown as Response;
      }
      if (u.endsWith('/users/kc1/role-mappings/realm')) {
        return { ok: true, json: async () => [{ id: 'r1', name: 'default-roles-haiwave-network' }, { id: 'r2', name: 'procurement_transact' }], text: async () => '' } as unknown as Response;
      }
      if (u.endsWith('/users/kc2/role-mappings/realm')) {
        return { ok: true, json: async () => [{ id: 'r1', name: 'default-roles-haiwave-network' }], text: async () => '' } as unknown as Response;
      }
      throw new Error(`unexpected fetch ${u}`);
    }));

    const users = (await listUsers('p-apex')) as Array<{ id: string; realmRoles?: string[] }>;

    expect(users.map((u) => [u.id, u.realmRoles])).toEqual([
      ['kc1', ['default-roles-haiwave-network', 'procurement_transact']],
      ['kc2', ['default-roles-haiwave-network']],
    ]);
  });
});

describe('listUsers — a refused or failed Keycloak read is never an empty roster (SEC-web-core-1-04)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws when Keycloak refuses the user list', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      return { ok: false, status: 403, text: async () => 'view-users missing' } as unknown as Response;
    }));

    await expect(listUsers('p-apex')).rejects.toThrow(/403/);
  });
});
