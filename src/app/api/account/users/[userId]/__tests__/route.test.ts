import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session and the owner check are doubled; the role vocabulary
// (isAssignableRole, resolveUserRole) is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
  hasRole: (userRole: string) => userRole === 'account_owner',
}));

vi.mock('@/lib/keycloak', () => ({
  // Returns the realm roles that govern after the change (D-212).
  updateUserRole: vi.fn(async (_userId: string, role: string) => ['default-roles-haiwave-network', role]),
  disableUser: vi.fn(async () => {}),
  getUser: vi.fn(),
}));

import { PATCH, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import { updateUserRole, disableUser, getUser } from '@/lib/keycloak';

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

  it('rejects disabling a user that belongs to a different participant', async () => {
    const res = await DELETE({} as unknown as Parameters<typeof DELETE>[0], ctx('u-foreign'));
    expect(res.status).toBe(404);
    expect(disableUser).not.toHaveBeenCalled();
  });
});
