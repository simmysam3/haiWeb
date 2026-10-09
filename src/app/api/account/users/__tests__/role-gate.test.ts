import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionFor, requestFor, NON_ADMINISTERING_ROLES } from '@/test/role-gate';

// Only the session is doubled; the role check is the real one.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getSession: vi.fn(),
}));
vi.mock('@/lib/keycloak', () => ({
  RealmRoleNotFoundError: class RealmRoleNotFoundError extends Error {},
  listUsers: vi.fn(async () => []),
  createUser: vi.fn(async () => 'user-2'),
  sendExecuteActionsEmail: vi.fn(async () => {}),
  getRealmRole: vi.fn(async (name: string) => ({ id: `id-${name}`, name })),
  updateUserRole: vi.fn(async (_userId: string, role: string) => [role]),
}));

import { GET, POST } from '../route';
import { getSession } from '@/lib/auth';
import * as keycloak from '@/lib/keycloak';

// An account_admin session whose token carried no participant.
function adminWithNoParticipant(): ReturnType<typeof sessionFor> {
  const s = sessionFor('account_admin');
  return { ...s, participant: { ...s.participant, id: '' } };
}
function signedInAs(session: ReturnType<typeof sessionFor> | null): void {
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session);
}

// Every call made to any Keycloak helper: a refusal must make none.
const keycloakCalls = () =>
  Object.values(keycloak)
    .filter((f) => vi.isMockFunction(f))
    .reduce((n, f) => n + (f as ReturnType<typeof vi.fn>).mock.calls.length, 0);

afterEach(() => vi.clearAllMocks());

describe('GET /api/account/users: who may list users', () => {
  it('lists the users of an account_admin\'s own participant', async () => {
    signedInAs(sessionFor('account_admin'));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(keycloak.listUsers).toHaveBeenCalledWith('participant-1');
  });

  it('lists for an account_owner', async () => {
    signedInAs(sessionFor('account_owner'));
    expect((await GET()).status).toBe(200);
  });

  it('asks Keycloak for the session\'s participant and no other', async () => {
    signedInAs(sessionFor('account_admin'));
    await GET();
    expect((keycloak.listUsers as ReturnType<typeof vi.fn>).mock.calls).toEqual([['participant-1']]);
    // The counter the refusals rely on does count.
    expect(keycloakCalls()).toBe(1);
  });

  it.each(NON_ADMINISTERING_ROLES)('refuses a %s with 403 before any Keycloak call', async (role) => {
    signedInAs(sessionFor(role));
    expect((await GET()).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });

  it('answers 401 without a session, before any Keycloak call', async () => {
    signedInAs(null);
    expect((await GET()).status).toBe(401);
    expect(keycloakCalls()).toBe(0);
  });
});

const invite = { email: 'new.user@example.test', first_name: 'New', last_name: 'User', role: 'buyer_view_only' };
const inviteRequest = (body: unknown = invite) => requestFor('POST', '/api/account/users', body);

describe('POST /api/account/users: who may invite a user', () => {
  it('lets an account_admin invite a user', async () => {
    signedInAs(sessionFor('account_admin'));
    const res = await POST(inviteRequest());
    expect(res.status).toBe(201);
    expect(keycloak.createUser).toHaveBeenCalledTimes(1);
  });

  it('lets an account_owner invite a user', async () => {
    signedInAs(sessionFor('account_owner'));
    expect((await POST(inviteRequest())).status).toBe(201);
  });

  it.each(NON_ADMINISTERING_ROLES)('refuses a %s with 403 before any Keycloak call', async (role) => {
    signedInAs(sessionFor(role));
    expect((await POST(inviteRequest())).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });

  it('answers 401 without a session, before any Keycloak call', async () => {
    signedInAs(null);
    expect((await POST(inviteRequest())).status).toBe(401);
    expect(keycloakCalls()).toBe(0);
  });
});

describe('POST /api/account/users: what an account_admin\'s invite can set', () => {
  it('puts the new user in the session\'s participant, never one named in the body', async () => {
    signedInAs(sessionFor('account_admin'));
    const res = await POST(
      inviteRequest({
        ...invite,
        participant_id: 'participant-2',
        attributes: { participant_id: ['participant-2'], job_title: ['Set By Body'] },
      }),
    );
    expect(res.status).toBe(201);
    const [params] = (keycloak.createUser as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(params.attributes).toEqual({ participant_id: ['participant-1'] });
  });

  it('asks the invited user to verify the email, set a password and set up an authenticator, on a four-day link', async () => {
    signedInAs(sessionFor('account_admin'));
    expect((await POST(inviteRequest())).status).toBe(201);
    expect(keycloak.sendExecuteActionsEmail).toHaveBeenCalledWith(
      'user-2',
      ['VERIFY_EMAIL', 'UPDATE_PASSWORD', 'CONFIGURE_TOTP'],
      { lifespanSeconds: 345600 },
    );
  });

  it.each(['account_owner', 'haiwave_admin', 'no_such_role'])(
    'refuses to assign the role %s: 400 and nobody is created',
    async (role) => {
      signedInAs(sessionFor('account_admin'));
      const res = await POST(inviteRequest({ ...invite, role }));
      expect(res.status).toBe(400);
      expect(keycloakCalls()).toBe(0);
    },
  );
});

describe('/api/account/users: a session that names no participant', () => {
  it('is refused the list with 403 before any Keycloak call', async () => {
    signedInAs(adminWithNoParticipant());
    expect((await GET()).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });

  it('is refused an invite with 403 before any Keycloak call', async () => {
    signedInAs(adminWithNoParticipant());
    expect((await POST(inviteRequest())).status).toBe(403);
    expect(keycloakCalls()).toBe(0);
  });
});

describe('GET /api/account/users: only the session\'s own participant\'s users are returned', () => {
  it('drops a user of another participant and a user with no participant from Keycloak\'s answer', async () => {
    signedInAs(sessionFor('account_admin'));
    (keycloak.listUsers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 'user-2', email: 'second.user@example.test', attributes: { participant_id: ['participant-1'] }, realmRoles: [] },
      { id: 'user-9', email: 'other.user@example.test', attributes: { participant_id: ['participant-2'] }, realmRoles: [] },
      { id: 'user-8', email: 'eighth.user@example.test', realmRoles: [] },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as Array<{ id: string }>).map((u) => u.id)).toEqual(['user-2']);
  });
});
