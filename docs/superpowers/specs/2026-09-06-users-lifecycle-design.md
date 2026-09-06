# Users lifecycle lane — design brief (hw-65, 2026-09-06, HaiWeb v1.89)

Base: haiWeb `origin/master` **ccc36c5f**. Worktree `~/dev/hw/haiWeb-users-lifecycle`, branch `users-lifecycle`.
Owner's rulings verbatim: `owner-rulings-2026-09-05.md` (09-06 15:2xZ). Agent1's answers: same ledger (15:3xZ).

## Scope (the owner's words → deliverable)

1. The role DEFINITION is shown AT the Role dropdown in the Invite and Edit dialogs. Nothing under the table; the sr-only pill text stays.
2. Edit a user's first and last name. Email is never editable; a wrong email = delete + invite again.
3. Hard delete of a user (Keycloak `DELETE /users/{id}` via the existing, currently unreachable `deleteUser`). Confirm dialog names the user; the route refuses self and foreign-tenant targets; failure copy in the #184 style (a plain sentence, never Keycloak's text).
4. "History persists" is said in the dialog only because it is verified (§Verified below).

Not built: Reactivate (the owner said "reactivation OR deletion and re-creation"; delete + re-create is the smaller footprint — one line to add if wanted). WK-3 (Escape) and WK-4 (Edit on a disabled row) are unchanged §L candidates.

## Decisions

**D1 — one vocabulary, one component.** `RoleSelect` (`src/app/account/users/role-select.tsx`): label + `<select>` + a definition line under it (`<p className="mt-1 text-xs text-slate">`), the select `aria-describedby` that line. Definition = `definitionFor('status', role)` from `src/components/pill.tsx` — the map `StatusBadge` already reads, so the pill's sr-only text and the dropdown's line can never disagree. The option list is the existing seven-role `ROLES` constant, moved into the component unchanged (account_admin stays out, as today). Both dialogs render `RoleSelect`.

**D2 — one Edit dialog.** The row control "Edit Role" becomes "Edit"; the dialog "Edit User" holds First name, Last name (prefilled), Email (read-only, disabled input) with the sentence "Email can't be changed. If it's wrong, delete this user and invite them again.", and `RoleSelect`. Save is disabled until something differs from the row and both trimmed names are non-empty; the request carries only the changed fields. Success: the row takes the response's fields (the role is the governing one, D-212), toast "User updated", and the roster is re-read (`refetch()`, as after an invite) so an in-flight load that predates the change can never revert it (§L-29); the same re-read follows a successful delete.

**D3 — honest BFF verbs on `/api/account/users/:id`.** Today `DELETE` means disable. After this lane:

- `PATCH` accepts any subset of `first_name`, `last_name`, `role`, `status`; an empty or unrecognised body is 400.
  - `status`: only `"disabled"`, and only on its own (400 otherwise). This is the Deactivate path (moved off DELETE). Refuses self (400), same tenant (404), one `disableUser` PUT; failure sentence unchanged: "The user could not be deactivated. Nothing was changed."
  - names: `first_name` and `last_name` travel together, both non-empty strings (400 otherwise); one `updateUserName` PUT.
  - `role`: allowlist (400), resolved with `getRealmRole` BEFORE any mutation (W-F4), so a missing role still says "Nothing was changed."
  - Order: validate → resolve role → tenant → name PUT → role change. Failure sentences (`patchFailureMessage(err, nameSaved, roleStarted)`): a missing role while no name has been saved → "The role X is not defined in the sign-in realm. Nothing was changed." (true for a role-only change and for the pre-write resolve; `updateUserRole` resolves again internally before it mutates, so a not-found from there after the name PUT falls to the "name was saved" sentence below — Task 2 review ruling); any other failure BEFORE the role change starts (the role lookup's transport, or the one name PUT — a refused PUT leaves the user as it was) → "The user could not be updated. Nothing was changed."; the role change fails with no name saved → the existing "The role change did not complete. Check the user's current role before trying again."; the role change fails after the name saved → "The name was saved, but the role change did not complete. Check the user's current role before trying again."
  - 200 body: `{ success, user_id, first_name?, last_name?, role?, status? }` — only what was applied; `role` is the governing role.
- `DELETE` = hard delete via `deleteUser`. The body must carry `{ email }` equal (case-insensitive) to the target's email — an interlock, not validation churn: a browser tab still running the previous bundle sends a body-less `DELETE` meaning "deactivate"; after the :3001 refresh that request must fail closed (400 "The request did not name the user to delete. Nothing was changed."), never delete. Refuses self (400 "You can't delete your own account."), same tenant (404, no disclosure), and — after the tenant check — an owner target: the route reads the target's realm roles and refuses with 400 "Account owners can't be deleted from the console." when `resolveUserRole(roles)` is `account_owner` (covers `haiwave_admin`; a delete is irreversible and the portal cannot re-create an owner — final-review ruling). The try holds one Keycloak call, so the failure sentence is "The user could not be deleted. Nothing was changed." 200 `{ success, user_id, deleted: true }` — the client requires `deleted === true` before it removes the row and toasts, because an older server instance reached mid-deploy answers the same DELETE by disabling and returning `{ success, user_id }` (final-review ruling).
- `assertSameTenant` returns the target representation (or null) so the email check reuses the one `getUser` read; `KeycloakUser` gains `email?`.

**D4 — Delete dialog.** Offered on every non-owner row, active or disabled (a disabled user is exactly the re-create case). Title "Delete User". Body: "Permanently delete **Jo Lee** (jo@acme.com)? They lose access immediately and the account can't be restored. To bring them back, invite them again. Records of what they did in this account are kept." Buttons Cancel / Delete (danger; "Deleting…" while busy). Success removes the row and toasts "User deleted"; failure shows the BFF sentence in the dialog, no toast, row stays.

**D5 — Keycloak helper.** `updateUserName(userId, firstName, lastName)`: `PUT /users/{id}` with body `{ firstName, lastName }` only — no `email`, no `username` — throws on any non-2xx. Test pins the body keys (negative: the body never carries `email`).

## Verified: what history the console keeps after a Keycloak delete

- haiCore has **no users table** (no `CREATE TABLE public.*user*` in `apps/core/drizzle/0000_baseline.sql`). Actor identity is stored as plain values with **no foreign key**: `audit_events.actor_id text NOT NULL` (+ `actor_type`; written from the token `sub`, e.g. `apps/core/src/routes/participants.ts:322`), `run_template_events.actor_user_id uuid` (nullable; `routes/sonar-compliance-requests.ts:67` coerces the `sub`), `concept_node_revisions.actor text`, `registration_request_events.actor text`. A Keycloak user delete therefore removes no history row.
- The console already renders actors **by id, never by Keycloak lookup**: `src/app/admin/audit/page.tsx:120` (`actor_id.slice(0, 8)`), `src/app/account/provenance-keys/generator/key-details-drawer.tsx:232` (`IdChip`), `src/app/account/sonar/_components/definition-editor.tsx:95` (`actor_user_id ?? 'system'`). What those pages show is unchanged after a delete.
- So the dialog may say "Records of what they did in this account are kept." The register sentence (D-212 amendment, v1.69) cites the tables above.

## Tests (spec-listed; TDD one at a time, red for the reason then green)

- `role-select.test.tsx` (new): the definition line shows the vocabulary's text for the selected role and changes with the selection; the select is described by it.
- `users-table.test.tsx`: Edit sends only the changed fields and shows the email sentence; Edit failure surfaces the sentence, no toast (adapted from the edit-role test); Deactivate sends `PATCH {status:'disabled'}` (adapted); Delete confirm names the user and email; Delete success removes the row with the toast; Delete failure keeps the row, no toast.
- `[userId]/__tests__/route.test.ts`: PATCH name-only calls `updateUserName` and never the role helpers; name PUT failure → "Nothing was changed"; role failure after the name saved → the combined sentence; missing role → "Nothing was changed" with no PUT; `status` alone → `disableUser`, self → 400; `status` with other fields → 400; DELETE without the matching email → 400 and `deleteUser` not called; DELETE self → 400; DELETE foreign → 404; DELETE ok; DELETE refusal sentence. The two existing DELETE-as-disable tests become PATCH-status tests.
- `src/lib/__tests__/keycloak.test.ts`: `updateUserName` PUTs `firstName`/`lastName` only; throws on refusal.

## Gate, PR, register

Gate at HOLD on the exact tree, inline under `/tmp/hw-vitest.lock`: `npm run build` · `USER_EMAIL=x USER_PASSWORD=x npx playwright test --list` · `npx vitest run --maxWorkers=3` (no `--minWorkers` on haiWeb) · eslint on touched files (baselined against master's copy) · `npx tsc --noEmit` (baseline 2 pre-existing test-file errors). State the protocol version the build compiled against.
PR: HaiWeb **v1.89 PR 1** by text if first to open (confirm the slot with agent1 at open). Register: D-212 amended in place + revision **v1.69** (reserved) as a haiCore docs-only PR AFTER the HaiWeb merge, citing the merge sha; no new D-row. No commercial ERP names in UI copy.
Not verified by this lane: the live walk (edit a name, delete a walk.* user) — the owner's, after the :3001 refresh; the dev realm still has no SMTP.
