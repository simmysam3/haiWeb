import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session and the owner check are doubled; the role vocabulary
// (isAssignableRole, resolveUserRole) is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
  hasRole: (userRole: string) => userRole === 'account_owner',
}));

vi.mock('@/lib/keycloak', () => {
  class RealmRoleNotFoundError extends Error {
    readonly roleName: string;
    constructor(roleName: string) {
      super(`Keycloak realm role not found: ${roleName}`);
      this.name = 'RealmRoleNotFoundError';
      this.roleName = roleName;
    }
  }
  return {
    RealmRoleNotFoundError,
    updateUserRole: vi.fn(async (_userId: string, role: string) => ['default-roles-haiwave-network', role]),
    updateUserName: vi.fn(async () => {}),
    disableUser: vi.fn(async () => {}),
    deleteUser: vi.fn(async () => {}),
    getRealmRole: vi.fn(async (name: string) => ({ id: `id-${name}`, name })),
    getUser: vi.fn(),
    getUserRealmRoles: vi.fn(async () => [
      { id: 'id-default', name: 'default-roles-haiwave-network' },
      { id: 'id-bvo', name: 'buyer_view_only' },
    ]),
  };
});

import { PATCH, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import {
  updateUserRole, updateUserName, disableUser, deleteUser, getUser, getUserRealmRoles, getRealmRole, RealmRoleNotFoundError,
} from '@/lib/keycloak';

const ownerSession = {
  user: { id: 'u-owner', role: 'account_owner' },
  participant: { id: 'p-apex' },
  is_admin: false,
};
const sameTenant = { id: 'u-target', email: 'jo@acme.com', attributes: { participant_id: ['p-apex'] } };
const otherTenant = { id: 'u-foreign', email: 'x@other.com', attributes: { participant_id: ['p-other'] } };

function patchReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}
function deleteReq(body?: unknown) {
  // No body → json() rejects, exactly as a body-less browser DELETE does.
  return {
    json: async () => { if (body === undefined) throw new SyntaxError('Unexpected end of JSON input'); return body; },
  } as unknown as Parameters<typeof DELETE>[0];
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });

describe('PATCH /api/account/users/:userId — role allowlist + tenant scoping', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(sameTenant);
  });
  afterEach(() => vi.clearAllMocks());

  it('rejects a role outside the assignable allowlist (no privilege escalation to platform admin)', async () => {
    const res = await PATCH(patchReq({ role: 'haiwave_admin' }), ctx('u-target'));
    expect(res.status).toBe(400);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('rejects modifying a user that belongs to a different participant', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(otherTenant);
    const res = await PATCH(patchReq({ role: 'account_admin' }), ctx('u-foreign'));
    expect(res.status).toBe(404);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('assigns an allowlisted role to a same-tenant user', async () => {
    const res = await PATCH(patchReq({ role: 'account_admin' }), ctx('u-target'));
    expect(res.status).toBe(200);
    expect(updateUserRole).toHaveBeenCalledWith('u-target', 'account_admin');
  });

  it('answers a plain sentence naming the undefined role, never Keycloak\'s own text (W-F4)', async () => {
    // The helper is doubled here, so this pins only what the route owns: the
    // message it shows. The resolve-before-mutate ordering it relies on is
    // exercised in the helper's own suite (src/lib/__tests__/keycloak.test.ts).
    (updateUserRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new RealmRoleNotFoundError('account_admin'),
    );
    const res = await PATCH(patchReq({ role: 'account_admin' }), ctx('u-target'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(
      'The role account_admin is not defined in the sign-in realm. Nothing was changed.',
    );
  });

  it('never claims the user is unchanged when a mutation may already have run', async () => {
    // Remove-first (D-212): a failure at the assignment POST leaves the stale
    // role already deleted, so "nothing was changed" would be a lie here.
    (updateUserRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak role assignment failed: 500 {"error":"unknown_error"}'),
    );
    const res = await PATCH(patchReq({ role: 'account_admin' }), ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/[Nn]othing was changed/);
    expect(error).not.toMatch(/Keycloak|unknown_error|500/);
    // "could not be changed" overstates: the stale role may already be gone.
    expect(error).toBe("The role change did not complete. Check the user's current role before trying again.");
  });

  it('reports the role that governs after the change, not the one requested (D-212)', async () => {
    // The target also holds account_owner, which this route never removes.
    (updateUserRole as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      'default-roles-haiwave-network', 'account_owner', 'buyer_view_only',
    ]);
    const res = await PATCH(patchReq({ role: 'buyer_view_only' }), ctx('u-target'));
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe('account_owner');
  });
});

describe('PATCH /api/account/users/:userId — name edit', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(sameTenant);
  });
  afterEach(() => vi.clearAllMocks());

  it('saves first and last name through the name helper and touches no role', async () => {
    const res = await PATCH(patchReq({ first_name: 'Jo', last_name: 'Lee' }), ctx('u-target'));
    expect(res.status).toBe(200);
    expect(updateUserName).toHaveBeenCalledWith('u-target', 'Jo', 'Lee');
    expect(updateUserRole).not.toHaveBeenCalled();
    expect(getRealmRole).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ success: true, user_id: 'u-target', first_name: 'Jo', last_name: 'Lee' });
  });

  it('says nothing was changed when the name PUT is refused', async () => {
    (updateUserName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak update user name failed: 500 boom'),
    );
    const res = await PATCH(patchReq({ first_name: 'Jo', last_name: 'Lee' }), ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/Keycloak|boom|500/);
    expect(error).toBe('The user could not be updated. Nothing was changed.');
  });

  it('says the name was saved when the role change fails after it', async () => {
    (updateUserRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak role assignment failed: 500 {"error":"unknown_error"}'),
    );
    const res = await PATCH(patchReq({ first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' }), ctx('u-target'));
    expect(res.status).toBe(500);
    expect(updateUserName).toHaveBeenCalledWith('u-target', 'Jo', 'Lee');
    const { error } = await res.json();
    expect(error).toBe("The name was saved, but the role change did not complete. Check the user's current role before trying again.");
  });

  it('resolves the role before any write: a missing role leaves the name untouched', async () => {
    (getRealmRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new RealmRoleNotFoundError('buyer_view_only'));
    const res = await PATCH(patchReq({ first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' }), ctx('u-target'));
    expect(res.status).toBe(500);
    expect(updateUserName).not.toHaveBeenCalled();
    expect(updateUserRole).not.toHaveBeenCalled();
    expect((await res.json()).error).toBe('The role buyer_view_only is not defined in the sign-in realm. Nothing was changed.');
  });

  it('requires both names together and rejects an empty body', async () => {
    const half = await PATCH(patchReq({ first_name: 'Jo' }), ctx('u-target'));
    expect(half.status).toBe(400);
    const blank = await PATCH(patchReq({ first_name: ' ', last_name: 'Lee' }), ctx('u-target'));
    expect(blank.status).toBe(400);
    const empty = await PATCH(patchReq({}), ctx('u-target'));
    expect(empty.status).toBe(400);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('says the name was saved when the role turns out missing at the role step', async () => {
    // updateUserRole resolves the role again before mutating; a not-found from
    // there arrives after the name PUT, so "Nothing was changed" would be false.
    (updateUserRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new RealmRoleNotFoundError('buyer_view_only'));
    const res = await PATCH(patchReq({ first_name: 'Jo', last_name: 'Lee', role: 'buyer_view_only' }), ctx('u-target'));
    expect(res.status).toBe(500);
    expect(updateUserName).toHaveBeenCalledWith('u-target', 'Jo', 'Lee');
    const { error } = await res.json();
    expect(error).not.toMatch(/[Nn]othing was changed/);
    expect(error).toBe("The name was saved, but the role change did not complete. Check the user's current role before trying again.");
  });
});

describe('PATCH /api/account/users/:userId — deactivation (status: disabled)', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(sameTenant);
  });
  afterEach(() => vi.clearAllMocks());

  it('disables a same-tenant user and reports the status', async () => {
    const res = await PATCH(patchReq({ status: 'disabled' }), ctx('u-target'));
    expect(res.status).toBe(200);
    expect(disableUser).toHaveBeenCalledWith('u-target');
    expect(await res.json()).toEqual({ success: true, user_id: 'u-target', status: 'disabled' });
  });

  it('answers a plain sentence when Keycloak refuses the deactivation', async () => {
    // disableUser mints a token then issues a single PUT, and the route's try
    // holds only that call — a failure leaves the user exactly as it was.
    (disableUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak disable user failed: 403 {"error":"HTTP 403 Forbidden"}'),
    );
    const res = await PATCH(patchReq({ status: 'disabled' }), ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/Keycloak|403|Forbidden/);
    expect(error).toBe('The user could not be deactivated. Nothing was changed.');
  });

  it('rejects disabling a user that belongs to a different participant', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(otherTenant);
    const res = await PATCH(patchReq({ status: 'disabled' }), ctx('u-foreign'));
    expect(res.status).toBe(404);
    expect(disableUser).not.toHaveBeenCalled();
  });

  it('refuses to deactivate the caller themselves', async () => {
    const res = await PATCH(patchReq({ status: 'disabled' }), ctx('u-owner'));
    expect(res.status).toBe(400);
    expect(disableUser).not.toHaveBeenCalled();
  });

  it('refuses status combined with other changes, and any status but disabled', async () => {
    const mixed = await PATCH(patchReq({ status: 'disabled', first_name: 'Jo', last_name: 'Lee' }), ctx('u-target'));
    expect(mixed.status).toBe(400);
    const active = await PATCH(patchReq({ status: 'active' }), ctx('u-target'));
    expect(active.status).toBe(400);
    expect(disableUser).not.toHaveBeenCalled();
    expect(updateUserName).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/account/users/:userId — permanent delete, named and tenant-scoped', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(sameTenant);
  });
  afterEach(() => vi.clearAllMocks());

  it('fails closed on a body-less DELETE (a stale tab\'s old "deactivate") — nothing is deleted or disabled', async () => {
    const res = await DELETE(deleteReq(), ctx('u-target'));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(disableUser).not.toHaveBeenCalled();
    expect((await res.json()).error).toBe('The request did not name the user to delete. Nothing was changed.');
  });

  it('refuses a body that names a different email', async () => {
    const res = await DELETE(deleteReq({ email: 'someone.else@acme.com' }), ctx('u-target'));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('deletes a same-tenant user when the body names them (case-insensitive)', async () => {
    const res = await DELETE(deleteReq({ email: 'Jo@Acme.com' }), ctx('u-target'));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith('u-target');
    // `deleted: true` is the contract the client requires before it removes the
    // row: an older instance that only disabled the user answers without it.
    expect(await res.json()).toEqual({ success: true, user_id: 'u-target', deleted: true });
  });

  it('refuses to delete the caller themselves', async () => {
    const res = await DELETE(deleteReq({ email: 'owner@acme.com' }), ctx('u-owner'));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
    // Only the self guard answers this sentence: the email-mismatch path, the
    // other 400 this request could take, names a different one.
    expect((await res.json()).error).toBe("You can't delete your own account.");
  });

  it('answers 404 for a user in another participant, even when named', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(otherTenant);
    const res = await DELETE(deleteReq({ email: 'x@other.com' }), ctx('u-foreign'));
    expect(res.status).toBe(404);
    expect(deleteUser).not.toHaveBeenCalled();
    // The tenant 404 comes first: a foreign target's roles are never read, so
    // the endpoint discloses nothing about users in another participant.
    expect(getUserRealmRoles).not.toHaveBeenCalled();
  });

  it('refuses to delete an account owner, even a same-tenant one named correctly', async () => {
    (getUserRealmRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'id-default', name: 'default-roles-haiwave-network' }, { id: 'id-owner', name: 'account_owner' },
    ]);
    const res = await DELETE(deleteReq({ email: 'jo@acme.com' }), ctx('u-target'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Account owners can't be deleted from the console.");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('treats a platform admin (haiwave_admin) as an owner for the refusal', async () => {
    (getUserRealmRoles as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'id-default', name: 'default-roles-haiwave-network' }, { id: 'id-ha', name: 'haiwave_admin' },
    ]);
    const res = await DELETE(deleteReq({ email: 'jo@acme.com' }), ctx('u-target'));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('says nothing was changed when the target\'s roles cannot be read', async () => {
    (getUserRealmRoles as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Keycloak role-mappings lookup failed: 500 boom'));
    const res = await DELETE(deleteReq({ email: 'jo@acme.com' }), ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/Keycloak|boom|500/);
    expect(error).toBe('The user could not be deleted. Nothing was changed.');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('answers a plain sentence when Keycloak refuses the delete', async () => {
    (deleteUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak delete user failed: 403 {"error":"HTTP 403 Forbidden"}'),
    );
    const res = await DELETE(deleteReq({ email: 'jo@acme.com' }), ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/Keycloak|403|Forbidden/);
    expect(error).toBe('The user could not be deleted. Nothing was changed.');
  });
});
