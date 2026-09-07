# Users Lifecycle (HaiWeb v1.89) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Users page shows each role's definition at the Role dropdown, lets an account owner edit a user's first and last name (never the email), and lets them permanently delete a user through a confirm dialog that names the user.

**Architecture:** One new client component (`RoleSelect`) is the single place both dialogs render the role dropdown and its definition line, reading the vocabulary `StatusBadge` already uses. The per-user BFF route gets honest verbs: `PATCH` changes attributes (name, role, or `status: "disabled"` — the Deactivate path moves here), `DELETE` hard-deletes and requires the target's email in the body as an interlock against a stale tab's old-meaning `DELETE`. One new Keycloak helper (`updateUserName`) PUTs `firstName`/`lastName` only.

**Tech Stack:** Next.js 15 route handlers, React client components, Vitest + Testing Library (jsdom), Keycloak admin REST API doubled with URL-routed `fetch` spies.

**Spec:** `docs/superpowers/specs/2026-09-06-users-lifecycle-design.md` (D1–D5 and the verified history claim).

## Global Constraints

- Base `origin/master` **ccc36c5f**; worktree `~/dev/hw/haiWeb-users-lifecycle`, branch `users-lifecycle`. Never `npm install` (node_modules is a clone of the primary's). Use `git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle …` and `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && …)`; never a bare `cd`.
- TDD one test at a time: write the test, run it, confirm it FAILS for the stated reason, then the minimum code, then GREEN. Never write production code without a failing test driving it.
- Doubles only at the Keycloak / BFF boundary: `vi.mock('@/lib/keycloak')` in route tests, `vi.spyOn(globalThis, 'fetch')` in component tests, `vi.stubGlobal('fetch', routedFetch(...))` in helper tests. `@/lib/auth` is mocked PARTIALLY via `importOriginal` so the role vocabulary stays real.
- Dialog copy: plain sentences, never Keycloak's text, status codes or the words "Keycloak"/"realm" except the already-shipped "not defined in the sign-in realm" sentence. "Nothing was changed." only while literally true. No commercial ERP names anywhere in UI copy.
- The census `src/__tests__/no-role-attribute.test.ts` fails on any source matching `/\battr(?:ibute)?s\??\.role\b|attributes\s*:\s*\{[^}]*\brole\s*:/` — never write a Keycloak `attributes` object that carries `role`. The census `src/__tests__/bff-mutations-are-role-gated.test.ts` requires every exported `PATCH`/`DELETE` to contain `hasRole(` — keep the existing checks.
- Test commands (from the worktree): `npx vitest run --maxWorkers=3 <path>` (haiWeb vitest REJECTS `--minWorkers`). Lint: `npx eslint <file>`; the `[userId]` path must be escaped as `'src/app/api/account/users/[[]userId[]]/route.ts'`. Baseline: all three touched source files lint with 0 problems on master.
- One commit per task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not push, open PRs, or touch any other worktree.

---

### Task 1: `updateUserName` Keycloak helper

**Files:**
- Modify: `src/lib/keycloak.ts` (after `disableUser`, ~line 357; `KeycloakUser` interface ~line 181)
- Test: `src/lib/__tests__/keycloak.test.ts` (append a new `describe` at the end)

**Interfaces:**
- Produces: `export async function updateUserName(userId: string, firstName: string, lastName: string): Promise<void>` — one `PUT ${keycloakAdminUrl}/users/{id}` with body exactly `{ firstName, lastName }`; throws `Error("Keycloak update user name failed: <status> <text>")` on non-2xx. `KeycloakUser` gains `email?: string`.

- [ ] **Step 1: Write the failing test (body carries the two name fields and nothing else)**

Append to `src/lib/__tests__/keycloak.test.ts` (the file already imports `describe, it, expect, vi, afterEach` and the helpers from `'../keycloak'`; add `updateUserName` to that import):

```ts
describe('updateUserName — the name PUT never touches the email', () => {
  afterEach(() => vi.unstubAllGlobals());

  function recordingFetch(refusePut = false) {
    const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      calls.push({ method, url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (u.includes('/protocol/openid-connect/token')) {
        return { ok: true, json: async () => ({ access_token: 't', expires_in: 60 }) } as unknown as Response;
      }
      if (refusePut) {
        return { ok: false, status: 403, text: async () => '{"error":"HTTP 403 Forbidden"}' } as unknown as Response;
      }
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' } as unknown as Response;
    }));
    return calls;
  }

  it('PUTs firstName and lastName only — no email, no username', async () => {
    const calls = recordingFetch();
    await updateUserName('u1', 'Jo', 'Lee');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toMatch(/\/users\/u1$/);
    // Exact key set: a body that also carried email/username would rename the login.
    expect(Object.keys(put!.body!).sort()).toEqual(['firstName', 'lastName']);
    expect(put!.body).toEqual({ firstName: 'Jo', lastName: 'Lee' });
  });

  it('throws when Keycloak refuses the PUT', async () => {
    recordingFetch(true);
    await expect(updateUserName('u1', 'Jo', 'Lee')).rejects.toThrow(/update user name failed/);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL because the export does not exist**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/lib/__tests__/keycloak.test.ts -t updateUserName)`
Expected: FAIL — `updateUserName is not a function` (or a TypeScript/ESM import error naming `updateUserName`). If it fails for any other reason, fix the test, not the code.

- [ ] **Step 3: Minimal implementation**

In `src/lib/keycloak.ts`, extend the interface:

```ts
export interface KeycloakUser {
  id: string;
  email?: string;
  attributes?: Record<string, string[]>;
}
```

and add after `disableUser`:

```ts
/**
 * Set the user's first and last name. The body carries those two fields and
 * nothing else: the email is the login and is never edited from the portal —
 * a wrong email is a delete + re-invite (owner ruling 2026-09-06).
 */
export async function updateUserName(
  userId: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const token = await getAdminToken();

  const res = await fetch(`${keycloakAdminUrl}/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ firstName, lastName }),
  });
  if (!res.ok) {
    throw new Error(`Keycloak update user name failed: ${res.status} ${await res.text()}`);
  }
}
```

- [ ] **Step 4: Run the whole helper suite — expect GREEN**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/lib/__tests__/keycloak.test.ts)`
Expected: all tests pass (the file had 17 before; now 19).

- [ ] **Step 5: Lint + commit**

```bash
(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx eslint src/lib/keycloak.ts src/lib/__tests__/keycloak.test.ts)
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle add src/lib/keycloak.ts src/lib/__tests__/keycloak.test.ts
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle commit -m "feat(keycloak): updateUserName PUTs firstName/lastName only

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Per-user BFF route — `PATCH` changes name / role / status, `DELETE` hard-deletes

**Files:**
- Modify: `src/app/api/account/users/[userId]/route.ts` (whole file)
- Test: `src/app/api/account/users/[userId]/__tests__/route.test.ts` (extend the mock; add tests; rewrite the two DELETE-as-disable tests)

**Interfaces:**
- Consumes: `updateUserName`, `deleteUser`, `getRealmRole`, `RealmRoleNotFoundError`, `KeycloakUser` from Task 1 / `@/lib/keycloak`.
- Produces (the wire contract the client in Task 4 uses):
  - `PATCH /api/account/users/:id` body: any subset of `{ first_name: string, last_name: string, role: string, status: "disabled" }`. 200 `{ success: true, user_id, first_name?, last_name?, role?, status? }` (only the applied fields; `role` = governing role). 400 sentences: `"No changes were requested."`, `"status can only be set to disabled, on its own."`, `"You can't deactivate your own account."`, `"first_name and last_name are required together"`, `"role is not assignable"`. 404 `{ error: "Not found" }` for a foreign/missing target. 500 `{ error }` per `patchFailureMessage`.
  - `DELETE /api/account/users/:id` body `{ email: string }`. 200 `{ success: true, user_id }`. 400 `"You can't delete your own account."` / `"The request did not name the user to delete. Nothing was changed."`; 404 foreign; 500 `"The user could not be deleted. Nothing was changed."`.

First, update the test file's mock factory and imports (this is setup, not a test — do it once before Step 1):

```ts
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
  };
});

import { PATCH, DELETE } from '../route';
import { getSession } from '@/lib/auth';
import {
  updateUserRole, updateUserName, disableUser, deleteUser, getUser, getRealmRole, RealmRoleNotFoundError,
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
```

Keep the six existing PATCH tests as they are (they still hold: role allowlist, foreign 404, same-tenant assign, W-F4 sentence, no-"nothing changed" after remove-first, governing role). Change their `beforeEach` `getUser` value to `sameTenant` and the foreign test's to `otherTenant`.

- [ ] **Step 1: Failing test — PATCH name-only calls `updateUserName`, never the role helpers, and echoes the names**

Add a new `describe('PATCH /api/account/users/:userId — name edit', …)` with the same `beforeEach`/`afterEach` as the role block:

```ts
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
});
```

- [ ] **Step 2: Run — expect FAIL: status 400 (the route still answers "role is required")**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 'src/app/api/account/users/[userId]' -t 'name edit')`
Expected: FAIL on `expect(res.status).toBe(200)` with received 400.

- [ ] **Step 3: Rewrite the route**

Replace the whole of `src/app/api/account/users/[userId]/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole, isAssignableRole, resolveUserRole } from "@/lib/auth";
import {
  updateUserRole,
  updateUserName,
  disableUser,
  deleteUser,
  getUser,
  getRealmRole,
  RealmRoleNotFoundError,
  type KeycloakUser,
} from "@/lib/keycloak";

// The target user when it belongs to the caller's participant, else null. A
// missing or foreign target is reported as 404 by the callers so the endpoint
// does not disclose the existence of users in other tenants.
async function sameTenantTarget(
  userId: string,
  participantId: string,
): Promise<KeycloakUser | null> {
  try {
    const target = await getUser(userId);
    return target.attributes?.participant_id?.[0] === participantId ? target : null;
  } catch {
    return null;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * A plain sentence for the Edit dialog. "Nothing was changed" is claimed only
 * while it is true: the role is resolved before any write, and the name PUT is
 * a single request, so every failure before the role change starts left the
 * user exactly as it was. Once the role change has started, remove-first
 * (D-212) means the old role may already be gone.
 */
function patchFailureMessage(err: unknown, nameSaved: boolean, roleStarted: boolean): string {
  // updateUserRole resolves the role again before it mutates, so a not-found
  // from there is still "nothing changed" for the role — but not for a name
  // saved a moment earlier (Task 2 review ruling).
  if (err instanceof RealmRoleNotFoundError && !nameSaved) {
    return `The role ${err.roleName} is not defined in the sign-in realm. Nothing was changed.`;
  }
  if (!roleStarted) {
    return "The user could not be updated. Nothing was changed.";
  }
  return nameSaved
    ? "The name was saved, but the role change did not complete. Check the user's current role before trying again."
    : "The role change did not complete. Check the user's current role before trying again.";
}

/**
 * PATCH /api/account/users/:userId
 *
 * Changes a user's name, role, or status (deactivation) in Keycloak. Requires
 * account_owner role. The email is never editable: a wrong email is a delete
 * and a fresh invitation (owner ruling 2026-09-06).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const { first_name, last_name, role, status } = await readJson(request);
  const wantsName = first_name !== undefined || last_name !== undefined;
  const wantsRole = role !== undefined;
  const wantsStatus = status !== undefined;

  if (!wantsName && !wantsRole && !wantsStatus) {
    return NextResponse.json({ error: "No changes were requested." }, { status: 400 });
  }

  // Deactivation travels alone so its single PUT keeps "Nothing was changed"
  // literally true (#184).
  if (wantsStatus) {
    if (status !== "disabled" || wantsName || wantsRole) {
      return NextResponse.json(
        { error: "status can only be set to disabled, on its own." },
        { status: 400 },
      );
    }
    if (userId === session.user.id) {
      return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
    }
    if (!(await sameTenantTarget(userId, session.participant.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
      await disableUser(userId);
      return NextResponse.json({ success: true, user_id: userId, status: "disabled" });
    } catch (err) {
      // The detail is for the server log; the dialog gets a plain sentence.
      console.error("[account/users PATCH] failed to deactivate user", err);
      return NextResponse.json(
        { error: "The user could not be deactivated. Nothing was changed." },
        { status: 500 },
      );
    }
  }

  if (wantsName && !(isNonEmptyString(first_name) && isNonEmptyString(last_name))) {
    return NextResponse.json(
      { error: "first_name and last_name are required together" },
      { status: 400 },
    );
  }
  if (wantsRole && (typeof role !== "string" || !isAssignableRole(role))) {
    return NextResponse.json({ error: "role is not assignable" }, { status: 400 });
  }

  let nameSaved = false;
  let roleStarted = false;
  try {
    // Resolve the role before touching anything (W-F4): a missing role must
    // leave the user exactly as it was — name included.
    if (wantsRole) {
      await getRealmRole(role as string);
    }

    if (!(await sameTenantTarget(userId, session.participant.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result: Record<string, unknown> = { success: true, user_id: userId };
    if (wantsName) {
      await updateUserName(userId, (first_name as string).trim(), (last_name as string).trim());
      nameSaved = true;
      result.first_name = (first_name as string).trim();
      result.last_name = (last_name as string).trim();
    }
    if (wantsRole) {
      roleStarted = true;
      // The realm role-mappings govern (D-212): report the role that applies
      // after the change, which may differ from the one requested when the
      // target holds a role this route never removes (account_owner).
      const governing = await updateUserRole(userId, role as string);
      result.role = resolveUserRole(governing);
    }
    return NextResponse.json(result);
  } catch (err) {
    // The detail is for the server log; the dialog gets a plain sentence.
    console.error("[account/users PATCH] failed to update user", err);
    return NextResponse.json(
      { error: patchFailureMessage(err, nameSaved, roleStarted) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/account/users/:userId
 *
 * Permanently deletes a user in Keycloak. Requires account_owner role. The
 * body must name the user (`{ email }`): a browser tab still running an older
 * bundle sends a body-less DELETE that used to mean "deactivate", and that
 * request must fail closed here, never delete. Records of what the user did
 * are kept — haiCore stores actors as plain ids with no link to Keycloak.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const target = await sameTenantTarget(userId, session.participant.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email } = await readJson(request);
  const named =
    isNonEmptyString(email) &&
    isNonEmptyString(target.email) &&
    email.trim().toLowerCase() === target.email.trim().toLowerCase();
  if (!named) {
    return NextResponse.json(
      { error: "The request did not name the user to delete. Nothing was changed." },
      { status: 400 },
    );
  }

  try {
    await deleteUser(userId);
    return NextResponse.json({ success: true, user_id: userId });
  } catch (err) {
    // The detail is for the server log; the dialog gets a plain sentence.
    // `deleteUser` is one DELETE and it is the only call in this try, so a
    // failure leaves the user exactly as it was.
    console.error("[account/users DELETE] failed to delete user", err);
    return NextResponse.json(
      { error: "The user could not be deleted. Nothing was changed." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run — expect the new test GREEN and the six existing PATCH tests still GREEN; the two old DELETE tests now FAIL (expected — they are rewritten next)**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 'src/app/api/account/users/[userId]')`

- [ ] **Step 5: Rewrite the two DELETE-as-disable tests as PATCH-status tests, and add the status guards (RED → GREEN each; the code from Step 3 should already satisfy them — if one is green on first run, break the route on purpose for a moment to prove the assertion can fail, then restore)**

Replace the `describe('DELETE /api/account/users/:userId — tenant scoping', …)` block with:

```ts
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
```

Run after each `it` is added: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 'src/app/api/account/users/[userId]')`

- [ ] **Step 6: Failing tests — the honest PATCH failure sentences (add one `it` at a time to the `name edit` describe; run after each)**

```ts
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
```

Expected per test on first run against the Step 3 route: GREEN. Because TDD requires seeing each fail for the right reason, for each one temporarily break the route (e.g. swap the sentence, or move `getRealmRole` after `updateUserName`), watch the test go RED with the expected message, then restore. Record in the task report which line you broke for each.

- [ ] **Step 7: Failing tests — DELETE (add one `it` at a time; run after each)**

```ts
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
    expect(await res.json()).toEqual({ success: true, user_id: 'u-target' });
  });

  it('refuses to delete the caller themselves', async () => {
    const res = await DELETE(deleteReq({ email: 'owner@acme.com' }), ctx('u-owner'));
    expect(res.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('answers 404 for a user in another participant, even when named', async () => {
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(otherTenant);
    const res = await DELETE(deleteReq({ email: 'x@other.com' }), ctx('u-foreign'));
    expect(res.status).toBe(404);
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
```

Same rule as Step 6: each must be seen RED (break the route, watch, restore) before it counts.

- [ ] **Step 8: Run the route suite, the sibling route suite, and the censuses — expect GREEN**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/api/account/users src/__tests__/bff-mutations-are-role-gated.test.ts src/__tests__/no-role-attribute.test.ts)`
Expected: all green.

- [ ] **Step 9: Lint + commit**

```bash
(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx eslint 'src/app/api/account/users/[[]userId[]]/route.ts' 'src/app/api/account/users/[[]userId[]]/__tests__/route.test.ts')
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle add 'src/app/api/account/users/[userId]/route.ts' 'src/app/api/account/users/[userId]/__tests__/route.test.ts'
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle commit -m "feat(users BFF): PATCH edits name/role/status, DELETE hard-deletes a named user

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `RoleSelect` — the dropdown with its definition line

**Files:**
- Create: `src/app/account/users/role-select.tsx`
- Test: `src/app/account/users/__tests__/role-select.test.tsx`

**Interfaces:**
- Consumes: `definitionFor(category: string, value: string): string | undefined` from `@/components/pill`; `STATUS_LABELS` from `@/components/status-badge`.
- Produces: `export const ROLES` (the seven assignable-in-the-UI role ids, moved verbatim from `users-table.tsx`) and `export function RoleSelect({ id, value, onChange }: { id: string; value: string; onChange: (role: string) => void })` — renders `<label htmlFor={id}>Role</label>`, the `<select id={id}>`, and `<p id={`${id}-definition`}>` holding `definitionFor('status', value)`; the select carries `aria-describedby={`${id}-definition`}`.

- [ ] **Step 1: Failing tests — ONE `it` AT A TIME.** Create the file with the imports, the `describe`, and only the FIRST `it`; run it (Step 2) and see it fail on module resolution; implement (Step 3); run green. Then add the second `it`, run; then the third, run. A test that is green on its first run must be shown fail-able: break the component (e.g. drop `aria-describedby`, or stop calling `onChange`), watch that test go red, restore, and record which line you broke in the report.

Create `src/app/account/users/__tests__/role-select.test.tsx` (final content after all three cycles):

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleSelect } from '../role-select';

describe('RoleSelect — the role definition is available at the dropdown', () => {
  it('shows the selected role\'s definition from the pill vocabulary and describes the select with it', () => {
    render(<RoleSelect id="invite-role" value="buyer_view_only" onChange={() => {}} />);
    const select = screen.getByLabelText('Role');
    // The literal text from src/components/pill.tsx (status → buyer_view_only):
    // the same string the pill reads out to a screen reader.
    const definition = screen.getByText('Buyer role with view-only access.');
    expect(definition).toBeVisible();
    expect(select).toHaveAttribute('aria-describedby', definition.id);
  });

  it('changes the definition with the selection and reports the new role', () => {
    const onChange = vi.fn();
    render(<RoleSelect id="edit-role" value="buyer_view_only" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    expect(onChange).toHaveBeenCalledWith('procurement_transact');
  });

  it('shows the definition of whatever value it is given (controlled)', () => {
    render(<RoleSelect id="edit-role" value="procurement_transact" onChange={() => {}} />);
    expect(screen.getByText('Procurement role permitted to transact.')).toBeInTheDocument();
    expect(screen.queryByText('Buyer role with view-only access.')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL: cannot resolve `../role-select`**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/account/users/__tests__/role-select.test.tsx)`

- [ ] **Step 3: Implement**

Create `src/app/account/users/role-select.tsx`:

```tsx
"use client";

import { definitionFor } from "@/components/pill";
import { STATUS_LABELS } from "@/components/status-badge";

/** The roles an account owner may pick in the Invite and Edit dialogs. */
export const ROLES = [
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
] as const;

interface RoleSelectProps {
  id: string;
  value: string;
  onChange: (role: string) => void;
}

/**
 * The Role dropdown with the selected role's definition under it. The copy
 * comes from the pill vocabulary (`definitionFor('status', role)`), the same
 * text the roster's pills read out to a screen reader, so the two can never
 * disagree (owner ruling 2026-09-06: available at the dropdown, not duplicated
 * under the table).
 */
export function RoleSelect({ id, value, onChange }: RoleSelectProps) {
  const definition = definitionFor("status", value);
  const definitionId = `${id}-definition`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-charcoal mb-1">Role</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={definition ? definitionId : undefined}
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{STATUS_LABELS[r] ?? r}</option>
        ))}
      </select>
      {definition && (
        <p id={definitionId} className="mt-1 text-xs text-slate">{definition}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect GREEN (3 tests)**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/account/users/__tests__/role-select.test.tsx)`

- [ ] **Step 5: Lint + commit**

```bash
(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx eslint src/app/account/users/role-select.tsx src/app/account/users/__tests__/role-select.test.tsx)
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle add src/app/account/users/role-select.tsx src/app/account/users/__tests__/role-select.test.tsx
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle commit -m "feat(users): RoleSelect shows the selected role's definition at the dropdown

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Users table — Edit dialog (name + role, read-only email), Deactivate via PATCH, Delete dialog

**Files:**
- Modify: `src/app/account/users/users-table.tsx` (whole file)
- Test: `src/app/account/users/__tests__/users-table.test.tsx` (adapt two tests, add four)

**Interfaces:**
- Consumes: `RoleSelect`, `ROLES` from `./role-select` (Task 3); the wire contract from Task 2.
- Produces: the page behaviour the owner walks. Row actions: `Edit` (every non-owner row) · `Deactivate` (active rows) · `Delete` (every non-owner row). Dialog titles: "Invite User", "Edit User", "Deactivate User", "Delete User". Toasts: "User updated", "User deactivated", "User deleted".

Test helpers already in the file: `jsonResponse`, `postCall`, `seedUser` (`id: 'u1'`, Jo Lee, `jo@acme.com`, `buyer_view_only`, active). Add `within` to the `@testing-library/react` import (`render, screen, fireEvent, waitFor, act, within`). Add beside `postCall`:

```ts
function callTo(fetchMock: ReturnType<typeof vi.spyOn>, url: string, method: string) {
  return fetchMock.mock.calls.find(
    (c: unknown[]) => c[0] === url && (c[1] as RequestInit | undefined)?.method === method,
  );
}
```

- [ ] **Step 1: Adapt the two existing mutation tests (they will go RED after the component change; adapt them first so the RED is for the new shape)**

In `describe('UsersTable — mutations surface failures (no fire-and-forget)')`:
- edit-role test: the row button is now `screen.getByRole('button', { name: /^edit$/i })`; the dialog is "Edit User"; keep `getByLabelText('Role')` and `/^save$/i`; assert the failure sentence is shown and `/user updated/i` is absent (replace `/role updated/i`).
- deactivate test: keep the flow; add, after the failure assertion:

```ts
    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH');
    expect(patch).toBeTruthy();
    expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({ status: 'disabled' });
```

- [ ] **Step 2: Failing test — Edit sends only the changed fields, shows the email sentence, and updates the row**

Add a new `describe('UsersTable — edit name and role (email is never editable)', …)`:

```tsx
describe('UsersTable — edit name and role (email is never editable)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('prefills the names, shows the email read-only with the delete-and-reinvite sentence, and sends only what changed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, user_id: 'u1', first_name: 'Josephine', last_name: 'Lee' })); // PATCH

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jo');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Lee');
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveValue('jo@acme.com');
    expect(email).toBeDisabled();
    expect(screen.getByText(/delete this user and invite them again/i)).toBeInTheDocument();
    // The role definition is available at the dropdown (WK-2 as ruled). Scoped
    // to the dialog: the roster pill for this row carries the same sentence as
    // screen-reader text, so an unscoped getByText would match two elements.
    const dialog = screen.getByRole('dialog', { name: /edit user/i });
    expect(within(dialog).getByText('Buyer role with view-only access.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Josephine' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(callTo(fetchMock, '/api/account/users/u1', 'PATCH')).toBeTruthy());
    const patch = callTo(fetchMock, '/api/account/users/u1', 'PATCH')!;
    // Only the name travelled: no role (an unchanged role must not trigger a
    // remove-then-add cycle), never an email.
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ first_name: 'Josephine', last_name: 'Lee' });

    expect(await screen.findByText('Josephine Lee')).toBeInTheDocument();
    expect(screen.getByText(/user updated/i)).toBeInTheDocument();
  });

  it('keeps Save disabled until something differs from the row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([seedUser]));
    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });
});
```

- [ ] **Step 3: Run — expect FAIL: no button named exactly "Edit" (the row still says "Edit Role")**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/account/users/__tests__/users-table.test.tsx)`

- [ ] **Step 4: Rewrite the component**

Replace `src/app/account/users/users-table.tsx` with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import type { MockUser } from "@/lib/mock-types";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";
import { RoleSelect } from "./role-select";

const FIELD_CLASS =
  "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";

export function UsersTable() {
  const { data: apiUsers, loading, error, refetch } = useApi<MockUser[]>({ url: "/api/account/users", fallback: [] });
  const [users, setUsers] = useState<MockUser[]>(apiUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<MockUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("buyer_view_only");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const { toast, showToast } = useToast();

  function openEdit(u: MockUser) {
    setActionError(null);
    setEditUser(u);
    setEditFirstName(u.first_name);
    setEditLastName(u.last_name);
    setEditRole(u.role);
  }
  function closeEdit() {
    setEditUser(null);
    setActionError(null);
  }
  function openDeactivate(u: MockUser) {
    setActionError(null);
    setDeactivateUser(u);
  }
  function closeDeactivate() {
    setDeactivateUser(null);
    setActionError(null);
  }
  function openDelete(u: MockUser) {
    setActionError(null);
    setDeleteTarget(u);
  }
  function closeDelete() {
    setDeleteTarget(null);
    setActionError(null);
  }

  useEffect(() => {
    setUsers(apiUsers);
  }, [apiUsers]);

  function closeInvite() {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteError(null);
  }

  async function handleInvite() {
    setInviteError(null);
    // The BFF requires all three; without them the invite 400s. Validate up
    // front rather than firing a request we know will fail.
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      setInviteError("Email, first name, and last name are all required.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/account/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        // Surface the real BFF error; do NOT add an optimistic row for a user
        // that was never created.
        const body = await res.json().catch(() => ({}));
        setInviteError(body.error ?? `Could not send the invitation (${res.status}).`);
        return;
      }
      const created = await res.json();
      const newUser: MockUser = {
        id: created.id,
        email: created.email ?? inviteEmail,
        first_name: created.first_name ?? inviteFirstName,
        last_name: created.last_name ?? inviteLastName,
        role: (created.role ?? inviteRole) as MockUser["role"],
        job_title: "",
        phone: "",
        status: "active",
        last_login: "Never",
      };
      setUsers((prev) => [...prev, newUser]);
      showToast(`Invitation sent to ${newUser.email}`);
      closeInvite();
      // Re-read the roster: the realm role is the governing record (D-212), so
      // the row must show the role the list endpoint resolves, not the one this
      // request echoed back. The refetch also supersedes an initial load still
      // in flight — useApi cancels it — so a roster that predates the invite can
      // no longer land and wipe the row just appended (§L-29).
      refetch();
    } catch {
      setInviteError("Could not reach the server. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  // Only what differs from the row travels: an unchanged role must not trigger
  // the remove-then-add cycle (D-212), and the email never travels at all.
  function editChanges(u: MockUser): Record<string, string> {
    const changes: Record<string, string> = {};
    const first = editFirstName.trim();
    const last = editLastName.trim();
    if (first !== u.first_name || last !== u.last_name) {
      changes.first_name = first;
      changes.last_name = last;
    }
    if (editRole !== u.role) changes.role = editRole;
    return changes;
  }
  const editDirty = editUser ? Object.keys(editChanges(editUser)).length > 0 : false;

  async function handleEdit() {
    if (!editUser) return;
    const changes = editChanges(editUser);
    if (Object.keys(changes).length === 0) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/account/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not update the user (${res.status}).`);
        return;
      }
      // The response carries only what was applied; the role is the governing
      // one (D-212), which may differ from the one requested.
      const applied = await res.json().catch(() => ({}));
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? {
        ...u,
        first_name: applied.first_name ?? u.first_name,
        last_name: applied.last_name ?? u.last_name,
        role: (applied.role ?? u.role) as MockUser["role"],
      } : u)));
      showToast("User updated");
      closeEdit();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateUser) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/account/users/${deactivateUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not deactivate the user (${res.status}).`);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === deactivateUser.id ? { ...u, status: "disabled" as const } : u)));
      showToast("User deactivated");
      closeDeactivate();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    setActionBusy(true);
    try {
      // The body names the user: the BFF deletes only a user it was told about
      // by email, so a mis-targeted or stale request fails closed.
      const res = await fetch(`/api/account/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteTarget.email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error ?? `Could not delete the user (${res.status}).`);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast("User deleted");
      closeDelete();
    } catch {
      setActionError("Could not reach the server. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  const columns: Column<MockUser>[] = [
    {
      key: "name",
      label: "Name",
      render: (u) => (
        <div>
          <p className="font-medium text-charcoal">{u.first_name} {u.last_name}</p>
          <p className="text-xs text-slate">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (u) => <StatusBadge status={u.role} />,
    },
    {
      key: "status",
      label: "Status",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "last_login",
      label: "Last Login",
      render: (u) => <span className="text-slate">{u.last_login === "Never" ? "Never" : new Date(u.last_login).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (u) => u.role === "account_owner" ? null : (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
            Edit
          </Button>
          {u.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => openDeactivate(u)}>
              Deactivate
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openDelete(u)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Rendered in both branches. A successful invite closes its dialog, so if the
  // re-read that follows fails the outage panel would be the only thing left on
  // the page and the user would read it as a failed invite and re-invite.
  const toastBanner = toast && (
    <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
      {toast}
    </div>
  );

  const actionErrorBanner = actionError && (
    <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
      {actionError}
    </div>
  );

  // A load failure must read as an outage, not as "this account has no users".
  if (error && !loading) {
    return (
      <>
        {toastBanner}
        <div className="bg-white rounded-lg border border-slate/15 p-8 text-center">
          <p className="text-sm font-medium text-problem">Could not load users.</p>
          <p className="mt-1 text-sm text-slate">There was a problem reaching the identity service. Your team members are safe — this is a display issue.</p>
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={refetch}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toastBanner}

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15 flex justify-between items-center">
          <p className="text-sm text-slate">{users.length} users</p>
          <Button size="sm" onClick={() => setInviteOpen(true)}>Invite User</Button>
        </div>
        <DataTable columns={columns} data={users} keyFn={(u) => u.id} />
      </div>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={closeInvite} title="Invite User">
        <div className="space-y-4">
          {inviteError && (
            <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
              {inviteError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="invite-first-name" className="block text-sm font-medium text-charcoal mb-1">First Name</label>
              <input
                id="invite-first-name"
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Jordan"
              />
            </div>
            <div>
              <label htmlFor="invite-last-name" className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
              <input
                id="invite-last-name"
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Reyes"
              />
            </div>
          </div>
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={FIELD_CLASS}
              placeholder="user@company.com"
            />
          </div>
          <RoleSelect id="invite-role" value={inviteRole} onChange={setInviteRole} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeInvite}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onClose={closeEdit} title="Edit User">
        <div className="space-y-4">
          {actionErrorBanner}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-first-name" className="block text-sm font-medium text-charcoal mb-1">First Name</label>
              <input
                id="edit-first-name"
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="edit-last-name" className="block text-sm font-medium text-charcoal mb-1">Last Name</label>
              <input
                id="edit-last-name"
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-email" className="block text-sm font-medium text-charcoal mb-1">Email Address</label>
            <input
              id="edit-email"
              type="email"
              value={editUser?.email ?? ""}
              disabled
              readOnly
              aria-describedby="edit-email-note"
              className={`${FIELD_CLASS} bg-light-gray text-slate`}
            />
            <p id="edit-email-note" className="mt-1 text-xs text-slate">
              Email can&apos;t be changed. If it&apos;s wrong, delete this user and invite them again.
            </p>
          </div>
          <RoleSelect id="edit-role" value={editRole} onChange={setEditRole} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeEdit}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionBusy || !editDirty}>{actionBusy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Modal */}
      <Modal open={!!deactivateUser} onClose={closeDeactivate} title="Deactivate User">
        {actionError && (
          <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
            {actionError}
          </div>
        )}
        <p className="text-sm text-charcoal mb-4">
          Are you sure you want to deactivate <strong>{deactivateUser?.first_name} {deactivateUser?.last_name}</strong>? They will lose access to the portal.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={closeDeactivate}>Cancel</Button>
          <Button variant="danger" onClick={handleDeactivate} disabled={actionBusy}>{actionBusy ? "Deactivating…" : "Deactivate"}</Button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={closeDelete} title="Delete User">
        {actionError && (
          <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
            {actionError}
          </div>
        )}
        <p className="text-sm text-charcoal mb-4">
          Permanently delete <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> ({deleteTarget?.email})?
          They lose access immediately and the account can&apos;t be restored. To bring them back, invite them again.
          Records of what they did in this account are kept.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={closeDelete}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={actionBusy}>{actionBusy ? "Deleting…" : "Delete"}</Button>
        </div>
      </Modal>
    </>
  );
}
```

Note: the `ROLES` constant and the `STATUS_LABELS` import leave this file — both now live in `role-select.tsx`. The test `getByLabelText(/email/i)` in the edit test resolves the one email field visible while the Edit dialog is open (the Invite dialog is closed, so its email input is not rendered).

- [ ] **Step 5: Run — expect the whole users-table suite GREEN (the adapted two, the two new edit tests, and the seven untouched ones)**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/account/users)`

- [ ] **Step 6: Failing tests — Delete (add one `it` at a time; each must be seen RED — break the component, watch, restore — before it counts)**

```tsx
describe('UsersTable — permanent delete', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('confirms by naming the user and their email, sends the email in the body, removes the row and toasts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, user_id: 'u1' })); // DELETE

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i })); // row button opens the modal

    const dialog = screen.getByRole('dialog', { name: /delete user/i });
    expect(dialog).toHaveTextContent('Jo Lee');
    expect(dialog).toHaveTextContent('jo@acme.com');
    expect(dialog).toHaveTextContent(/can't be restored/i);
    expect(dialog).toHaveTextContent(/records of what they did in this account are kept/i);

    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]); // modal confirm

    await waitFor(() => expect(callTo(fetchMock, '/api/account/users/u1', 'DELETE')).toBeTruthy());
    const del = callTo(fetchMock, '/api/account/users/u1', 'DELETE')!;
    expect(JSON.parse((del[1] as RequestInit).body as string)).toEqual({ email: 'jo@acme.com' });

    await waitFor(() => expect(screen.queryByText('Jo Lee')).not.toBeInTheDocument());
    expect(screen.getByText(/user deleted/i)).toBeInTheDocument();
  });

  it('surfaces the BFF sentence, keeps the row and shows no toast when the delete fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse([seedUser])); // initial GET
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'The user could not be deleted. Nothing was changed.' }, 500));

    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    const buttons = screen.getAllByRole('button', { name: /^delete$/i });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(/could not be deleted/i)).toBeInTheDocument();
    // Scoped to the table: the confirm dialog stays open on failure and its
    // <strong>Jo Lee</strong> would make an unscoped query ambiguous.
    expect(within(screen.getByRole('table')).getByText('Jo Lee')).toBeInTheDocument();
    expect(screen.queryByText(/user deleted/i)).not.toBeInTheDocument();
  });

  it('offers Delete on a disabled row too (the re-create path for a wrong email)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([{ ...seedUser, status: 'disabled' }]));
    render(<UsersTable />);
    await screen.findByText('Jo Lee');
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the page suites and the role-select suite — expect GREEN**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx vitest run --maxWorkers=3 src/app/account/users)`

- [ ] **Step 8: Lint + typecheck + commit**

```bash
(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx eslint src/app/account/users/users-table.tsx src/app/account/users/__tests__/users-table.test.tsx)
(cd /Users/samfleming/dev/hw/haiWeb-users-lifecycle && npx tsc --noEmit -p tsconfig.json > /tmp/hw65-tsc.txt 2>&1; echo "tsc exit $?"; grep -c "error TS" /tmp/hw65-tsc.txt)
```
Expected: eslint 0 problems; tsc error count == master's baseline of 2 (both in pre-existing test files, neither under `src/app/account/users` or `src/app/api/account/users`). If the count is higher, the new errors are yours — fix them.

```bash
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle add src/app/account/users/users-table.tsx src/app/account/users/__tests__/users-table.test.tsx
git -C /Users/samfleming/dev/hw/haiWeb-users-lifecycle commit -m "feat(users): Edit dialog (name + role, read-only email), Deactivate via PATCH, permanent Delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review (done at authoring)

- **Spec coverage:** D1 → Task 3 (+ Task 4 renders it in both dialogs). D2 → Task 4. D3 → Task 2 (PATCH subsets, status alone, resolve-before-mutate, sentences, DELETE interlock, self, tenant). D4 → Task 4 Step 6. D5 → Task 1. Verified history claim → the Delete dialog sentence (Task 4) and the DELETE handler's comment (Task 2); the register sentence is the controller's, after the merge.
- **Placeholders:** none; every step carries its code and its command.
- **Type consistency:** `updateUserName(userId, firstName, lastName)` (Task 1) is what Task 2 calls; `RoleSelect({ id, value, onChange })` (Task 3) is what Task 4 renders; the PATCH body keys `first_name`/`last_name`/`role`/`status` and the DELETE body `{ email }` (Task 2) are what Task 4 sends; `KeycloakUser.email?` (Task 1) is what Task 2's interlock reads.
- **Not in this plan (by ruling):** Reactivate; Escape-to-close (WK-3); Edit hidden on disabled rows (WK-4); a server-side refusal to delete an account_owner target (the UI hides owner rows; §L candidate).
