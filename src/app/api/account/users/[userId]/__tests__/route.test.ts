import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session and the owner check are doubled; the role vocabulary
// (isAssignableRole, resolveUserRole) is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
  hasRole: (userRole: string) => userRole === 'account_owner',
}));

vi.mock('@/lib/keycloak', () => {
  // Defined inside the factory so the route's `instanceof` and the tests' `new`
  // reference the same class (vi.mock is hoisted above module scope).
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
    // Returns the realm roles that govern after the change (D-212).
    updateUserRole: vi.fn(async (_userId: string, role: string) => ['default-roles-haiwave-network', role]),
    disableUser: vi.fn(async () => {}),
    getUser: vi.fn(),
  };
});

import { PATCH, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import { updateUserRole, disableUser, getUser, RealmRoleNotFoundError } from '@/lib/keycloak';

const ownerSession = {
  user: { id: 'u-owner', role: 'account_owner' },
  participant: { id: 'p-apex' },
  is_admin: false,
};

function patchReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });

describe('PATCH /api/account/users/:userId — role allowlist + tenant scoping', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ attributes: { participant_id: ['p-apex'] } });
  });
  afterEach(() => vi.clearAllMocks());

  it('rejects a role outside the assignable allowlist (no privilege escalation to platform admin)', async () => {
    const res = await PATCH(patchReq({ role: 'haiwave_admin' }), ctx('u-target'));
    expect(res.status).toBe(400);
    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it('rejects modifying a user that belongs to a different participant', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ attributes: { participant_id: ['p-other'] } });
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

describe('DELETE /api/account/users/:userId — tenant scoping', () => {
  beforeEach(() => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ attributes: { participant_id: ['p-other'] } });
  });
  afterEach(() => vi.clearAllMocks());

  it('answers a plain sentence when Keycloak refuses the deactivation', async () => {
    // disableUser mints a token then issues a single PUT, and the route's try
    // holds only that call — a failure leaves the user exactly as it was.
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ attributes: { participant_id: ['p-apex'] } });
    (disableUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Keycloak disable user failed: 403 {"error":"HTTP 403 Forbidden"}'),
    );
    const res = await DELETE({} as unknown as Parameters<typeof DELETE>[0], ctx('u-target'));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error).not.toMatch(/Keycloak|403|Forbidden/);
    expect(error).toBe('The user could not be deactivated. Nothing was changed.');
  });

  it('rejects disabling a user that belongs to a different participant', async () => {
    const res = await DELETE({} as unknown as Parameters<typeof DELETE>[0], ctx('u-foreign'));
    expect(res.status).toBe(404);
    expect(disableUser).not.toHaveBeenCalled();
  });
});
