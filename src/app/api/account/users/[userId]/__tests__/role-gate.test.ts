import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionFor, requestFor, NON_ADMINISTERING_ROLES } from '@/test/role-gate';

// Only the session is doubled; the role check is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
}));
vi.mock('@/lib/keycloak', () => ({
  RealmRoleNotFoundError: class RealmRoleNotFoundError extends Error {},
  updateUserRole: vi.fn(async (_userId: string, role: string) => [role]),
  updateUserName: vi.fn(async () => {}),
  disableUser: vi.fn(async () => {}),
  deleteUser: vi.fn(async () => {}),
  getRealmRole: vi.fn(async (name: string) => ({ id: `id-${name}`, name })),
  getUser: vi.fn(),
  getUserRealmRoles: vi.fn(async () => [{ id: 'id-bvo', name: 'buyer_view_only' }]),
}));

import { PATCH, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import * as keycloak from '@/lib/keycloak';

// sessionFor's caller is user-1 of participant-1.
const colleague = { id: 'user-2', email: 'second.user@example.test', attributes: { participant_id: ['participant-1'] } };
const stranger = { id: 'user-9', email: 'other.user@example.test', attributes: { participant_id: ['participant-2'] } };
const rename = { first_name: 'Second', last_name: 'User' };

function signedInAs(session: ReturnType<typeof sessionFor> | null): void {
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session);
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });
const patchRequest = (userId: string, body: unknown) => requestFor('PATCH', `/api/account/users/${userId}`, body);
const deleteRequest = (userId: string, body: unknown) => requestFor('DELETE', `/api/account/users/${userId}`, body);

// Every call made to any Keycloak helper: a refusal must make none.
const keycloakCalls = () =>
  Object.values(keycloak)
    .filter((f) => vi.isMockFunction(f))
    .reduce((n, f) => n + (f as ReturnType<typeof vi.fn>).mock.calls.length, 0);
// The helpers that change a user. A 404 for another participant's user must reach none of them.
const writes = () =>
  [keycloak.updateUserName, keycloak.updateUserRole, keycloak.disableUser, keycloak.deleteUser].reduce(
    (n, f) => n + (f as ReturnType<typeof vi.fn>).mock.calls.length,
    0,
  );

// Braces, not an expression body: a function returned from beforeEach is run
// as that test's cleanup, and a returned mock would count as a Keycloak call.
beforeEach(() => {
  (keycloak.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(colleague);
});
afterEach(() => vi.clearAllMocks());

describe('PATCH /api/account/users/:userId: who may edit a user', () => {
  it('lets an account_admin rename a user of their own participant', async () => {
    signedInAs(sessionFor('account_admin'));
    const res = await PATCH(patchRequest('user-2', rename), ctx('user-2'));
    expect(res.status).toBe(200);
    expect(keycloak.updateUserName).toHaveBeenCalledWith('user-2', 'Second', 'User');
  });

  it('lets an account_owner rename a user of their own participant', async () => {
    signedInAs(sessionFor('account_owner'));
    expect((await PATCH(patchRequest('user-2', rename), ctx('user-2'))).status).toBe(200);
  });

  it.each(NON_ADMINISTERING_ROLES)('refuses a %s with 403 before any Keycloak call', async (role) => {
    signedInAs(sessionFor(role));
    expect((await PATCH(patchRequest('user-2', rename), ctx('user-2'))).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });

  it('answers 401 without a session, before any Keycloak call', async () => {
    signedInAs(null);
    expect((await PATCH(patchRequest('user-2', rename), ctx('user-2'))).status).toBe(401);
    expect(keycloakCalls()).toBe(0);
  });
});

describe('PATCH /api/account/users/:userId: what an account_admin\'s edit can reach', () => {
  beforeEach(() => signedInAs(sessionFor('account_admin')));

  it.each([
    ['a rename', rename],
    ['a role change', { role: 'buyer_view_only' }],
    ['a deactivation', { status: 'disabled' }],
  ])('answers 404 to %s of another participant\'s user and changes nothing', async (_what, body) => {
    (keycloak.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(stranger);
    const res = await PATCH(patchRequest('user-9', body), ctx('user-9'));
    expect(res.status).toBe(404);
    expect(writes()).toBe(0);
  });

  it.each(['account_owner', 'haiwave_admin', 'no_such_role'])(
    'refuses to assign the role %s: 400 before any Keycloak call',
    async (role) => {
      const res = await PATCH(patchRequest('user-2', { role }), ctx('user-2'));
      expect(res.status).toBe(400);
      expect(keycloakCalls()).toBe(0);
    },
  );

  it('sends Keycloak the two names only, whatever else the body carries', async () => {
    const res = await PATCH(
      patchRequest('user-2', {
        ...rename,
        participant_id: 'participant-2',
        attributes: { participant_id: ['participant-2'] },
        email: 'changed@example.test',
      }),
      ctx('user-2'),
    );
    expect(res.status).toBe(200);
    expect((keycloak.updateUserName as ReturnType<typeof vi.fn>).mock.calls).toEqual([['user-2', 'Second', 'User']]);
    // The read of the target and the one write: nothing else was sent.
    expect(keycloakCalls()).toBe(2);
  });
});

describe('DELETE /api/account/users/:userId: who may delete a user', () => {
  it('lets an account_admin delete a named user of their own participant', async () => {
    signedInAs(sessionFor('account_admin'));
    const res = await DELETE(deleteRequest('user-2', { email: colleague.email }), ctx('user-2'));
    expect(res.status).toBe(200);
    expect(keycloak.deleteUser).toHaveBeenCalledWith('user-2');
  });

  it('lets an account_owner delete a named user of their own participant', async () => {
    signedInAs(sessionFor('account_owner'));
    expect((await DELETE(deleteRequest('user-2', { email: colleague.email }), ctx('user-2'))).status).toBe(200);
  });

  it.each(NON_ADMINISTERING_ROLES)('refuses a %s with 403 before any Keycloak call', async (role) => {
    signedInAs(sessionFor(role));
    expect((await DELETE(deleteRequest('user-2', { email: colleague.email }), ctx('user-2'))).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });

  it('answers 401 without a session, before any Keycloak call', async () => {
    signedInAs(null);
    expect((await DELETE(deleteRequest('user-2', { email: colleague.email }), ctx('user-2'))).status).toBe(401);
    expect(keycloakCalls()).toBe(0);
  });

  it('answers 404 to an account_admin for another participant\'s user, even when named, and changes nothing', async () => {
    signedInAs(sessionFor('account_admin'));
    (keycloak.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(stranger);
    const res = await DELETE(deleteRequest('user-9', { email: stranger.email }), ctx('user-9'));
    expect(res.status).toBe(404);
    expect(writes()).toBe(0);
    // Only the read of the target: its roles are never asked for.
    expect(keycloakCalls()).toBe(1);
  });
});
