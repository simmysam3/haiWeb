import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionFor, requestFor } from '@/test/role-gate';

// Only the session is doubled. The role check and the Keycloak library are the
// real ones; Keycloak itself is a fetch stub that records every request.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
}));

import { POST } from '../route';
import { getSession } from '@/lib/auth';

interface Sent {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

function keycloakStub(sent: Sent[]) {
  const answer = (body: unknown, location?: string) =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => '',
      headers: { get: (k: string) => (k === 'Location' ? (location ?? null) : null) },
    }) as unknown as Response;
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/protocol/openid-connect/token')) {
      return answer({ access_token: 'stub-token', expires_in: 60 });
    }
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^.*\/admin\/realms\/[^/]+/, '');
    sent.push({ method, path, query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'GET' && path === '/roles') return answer([{ id: 'role-1', name: url.searchParams.get('search') }]);
    if (method === 'POST' && path === '/users') return answer(null, '/admin/realms/stub/users/user-2');
    if (method === 'GET' && path === '/users/user-2/role-mappings/realm') return answer([]);
    return answer(null);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/account/users: the requests an invite sends to Keycloak', () => {
  it('creates the user with the password and authenticator steps pending on the account', async () => {
    const sent: Sent[] = [];
    vi.stubGlobal('fetch', keycloakStub(sent));
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(sessionFor('account_admin'));

    const res = await POST(
      requestFor('POST', '/api/account/users', {
        email: 'new.user@example.test',
        first_name: 'New',
        last_name: 'User',
        role: 'buyer_view_only',
      }),
    );
    expect(res.status).toBe(201);

    const create = sent.find((r) => r.method === 'POST' && r.path === '/users');
    expect((create?.body as { requiredActions?: string[] }).requiredActions).toEqual(['UPDATE_PASSWORD', 'CONFIGURE_TOTP']);

    // The link still asks for all three, for four days, and the order of the
    // requests is unchanged: role lookup, create, role, email.
    expect(sent.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /roles',
      'POST /users',
      'GET /roles',
      'GET /users/user-2/role-mappings/realm',
      'POST /users/user-2/role-mappings/realm',
      'PUT /users/user-2/execute-actions-email',
    ]);
    const email = sent[sent.length - 1];
    expect(email.body).toEqual(['VERIFY_EMAIL', 'UPDATE_PASSWORD', 'CONFIGURE_TOTP']);
    expect(email.query.get('lifespan')).toBe('345600');
  });
});
