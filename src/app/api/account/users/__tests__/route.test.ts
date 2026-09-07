import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Only the session and the owner check are doubled; the role vocabulary
// (isAssignableRole, resolveUserRole) is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
  hasRole: (role: string) => role === 'account_owner',
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
    listUsers: vi.fn(async () => []),
    createUser: vi.fn(async () => 'u-new'),
    sendExecuteActionsEmail: vi.fn(async () => {}),
    getRealmRole: vi.fn(async (name: string) => ({ id: `id-${name}`, name })),
    updateUserRole: vi.fn(async (_userId: string, role: string) => ['default-roles-haiwave-network', role]),
  };
});
vi.mock('@/lib/mock-data', () => ({ MOCK_USERS: [] }));

import { GET, POST } from '../route';
import { getSession } from '@/lib/auth';
import { createUser, sendExecuteActionsEmail, listUsers, updateUserRole, getRealmRole, RealmRoleNotFoundError } from '@/lib/keycloak';

const owner = { user: { id: 'u-owner', role: 'account_owner' }, participant: { id: 'p-apex' }, is_admin: false };
const invite = { email: 'new@apex.com', first_name: 'New', last_name: 'User', role: 'buyer_view_only' };
const req = (body: unknown) =>
  new NextRequest('http://localhost/api/account/users', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(owner));
afterEach(() => vi.clearAllMocks());

describe('POST /api/account/users — invited-user provisioning', () => {
  it('creates the user without a permanent inviter password', async () => {
    await POST(req(invite));
    const params = (createUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(params).not.toHaveProperty('password');
    expect(params.attributes.participant_id).toEqual(['p-apex']);
  });

  it('triggers the verify-email + set-password action email', async () => {
    const res = await POST(req(invite));
    expect(res.status).toBe(201);
    expect(sendExecuteActionsEmail).toHaveBeenCalledWith('u-new', ['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
  });

  it('403s a non-owner', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ ...owner, user: { ...owner.user, role: 'buyer_view_only' } });
    const res = await POST(req(invite));
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects a role outside the assignable allowlist before creating anyone (D-212)', async () => {
    const res = await POST(req({ ...invite, role: 'haiwave_admin' }));
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('assigns the chosen realm role to the created user (D-212)', async () => {
    const res = await POST(req(invite));
    expect(res.status).toBe(201);
    expect(updateUserRole).toHaveBeenCalledWith('u-new', 'buyer_view_only');
  });

  it('creates nobody when the realm role cannot be resolved (W-F4: no orphaned Keycloak user)', async () => {
    (getRealmRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new RealmRoleNotFoundError('buyer_view_only'),
    );
    const res = await POST(req(invite));
    expect(res.status).toBe(500);
    // A plain sentence for the dialog; Keycloak's own text never reaches it.
    expect((await res.json()).error).toBe(
      'The role buyer_view_only is not defined in the sign-in realm. Nothing was created.',
    );
    expect(createUser).not.toHaveBeenCalled();
    expect(sendExecuteActionsEmail).not.toHaveBeenCalled();
  });

  it('never claims "nothing was created" once the user exists — the role step failed', async () => {
    (updateUserRole as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Keycloak role assignment failed: 500'));
    const res = await POST(req(invite));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(createUser).toHaveBeenCalled();
    expect(error).not.toMatch(/[Nn]othing was created/);
    expect(error).toBe(
      'The user was created but their role could not be set. An administrator must finish setting up the account.',
    );
  });

  it('names the email step, not the role step, when only the invitation email fails', async () => {
    (sendExecuteActionsEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('smtp down'));
    const res = await POST(req(invite));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(updateUserRole).toHaveBeenCalled();
    expect(error).toBe('The user was created but the invitation email could not be sent.');
  });

  it('writes no role attribute on the Keycloak user — the realm role is the only record (D-212)', async () => {
    await POST(req(invite));
    const params = (createUser as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(params.attributes).not.toHaveProperty('role');
  });
});

describe('GET /api/account/users — Keycloak → DTO mapping', () => {
  it('maps raw Keycloak users to the snake_case account DTO the table renders', async () => {
    (listUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'kc1', email: 'a@b.com', firstName: 'Ada', lastName: 'Lovelace', enabled: true, realmRoles: ['procurement_transact'] },
      { id: 'kc2', email: 'x@y.com', firstName: 'Grace', lastName: 'Hopper', enabled: false },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({ id: 'kc1', email: 'a@b.com', first_name: 'Ada', last_name: 'Lovelace', role: 'procurement_transact', status: 'active' }),
      expect.objectContaining({ id: 'kc2', first_name: 'Grace', last_name: 'Hopper', role: 'buyer_view_only', status: 'disabled' }),
    ]);
  });

  it('returns an error (never mock users) when Keycloak is unavailable', async () => {
    (listUsers as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('kc down'));
    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false); // an outage must NOT return a user list
    expect(body.error).toBeTruthy();
  });
});
