import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session is doubled; the role gate (hasRole) is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
}));
vi.mock('@/lib/keycloak', () => ({ listUsers: vi.fn() }));

import { GET } from '../route';
import { getSession } from '@/lib/auth';
import { listUsers } from '@/lib/keycloak';

const session = (role: string) => ({ user: { id: 'u-1', role }, participant: { id: 'p-apex' }, is_admin: false });
const rep = (over: Record<string, unknown>) => ({
  id: 'u-a', email: 'a@apex.com', firstName: 'Ana', lastName: 'Ruiz', enabled: true,
  attributes: { phone: ['555'] }, realmRoles: ['account_admin'], ...over,
});

beforeEach(() => {
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session('account_admin'));
  (listUsers as ReturnType<typeof vi.fn>).mockResolvedValue([rep({})]);
});
afterEach(() => vi.clearAllMocks());

describe('GET /api/account/sourcing-map/seat-users', () => {
  it('serves exactly { user_id, name } per user, never email, role or phone', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: Array<Record<string, unknown>> };
    expect(body.users).toHaveLength(1);
    expect(Object.keys(body.users[0]!).sort()).toEqual(['name', 'user_id']);
    expect(body.users[0]).toEqual({ user_id: 'u-a', name: 'Ana Ruiz' });
    expect(listUsers).toHaveBeenCalledWith('p-apex');
  });

  it('excludes a disabled user', async () => {
    (listUsers as ReturnType<typeof vi.fn>).mockResolvedValue([rep({}), rep({ id: 'u-b', enabled: false })]);
    const body = (await (await GET()).json()) as { users: Array<{ user_id: string }> };
    expect(body.users.map((u) => u.user_id)).toEqual(['u-a']);
  });

  it('names a user with no first or last name by email, then by id', async () => {
    (listUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
      rep({ id: 'u-c', firstName: undefined, lastName: undefined }),
      rep({ id: 'u-d', firstName: undefined, lastName: undefined, email: undefined }),
    ]);
    const body = (await (await GET()).json()) as { users: Array<{ name: string }> };
    expect(body.users.map((u) => u.name)).toEqual(['a@apex.com', 'u-d']);
  });

  it('answers 502, never an empty list, when Keycloak fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (listUsers as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('keycloak down'));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).not.toHaveProperty('users');
  });

  it('answers 403 before listUsers for buyer_view_only', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session('buyer_view_only'));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('answers 401 without a session', async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listUsers).not.toHaveBeenCalled();
  });
});
