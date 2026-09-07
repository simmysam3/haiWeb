# §L-34 — an invite that created the user but could not finish (HaiWeb v1.89 PR 4)

**Owner's ruling 2026-09-07:** "lift §L-34" (TASK). Walked live 09-07 15:2xZ on :3001 @ 0ff560ff: with no dev SMTP, Send Invitation returned the honest banner "The user was created but the invitation email could not be sent." — but the dialog stayed open with Send still enabled and the roster said "7 users" while Keycloak already held the 8th, until a reload. A second Send would re-POST the same email.

## Root cause
`POST /api/account/users` answers every failure with `500 { error }`. The client's invite handler treats every non-2xx as "nothing was created" (`if (!res.ok) { setInviteError(...); return; }`) — right for the W-F4 nothing-created path, wrong for the two created-but-incomplete paths (role not set · email not sent), where a user now exists in the realm.

## Design (whole surface, additive)
- **BFF says what exists.** When the failure happened after `createUser`, the error body also carries `user_id`. The nothing-created body is unchanged (no key) — the client's existing behaviour for it is untouched. Spelled `user_id` like the PATCH/DELETE bodies; it is the same fact the 201 body returns as `id`, so the browser learns nothing new; its presence is the discriminator the client keys on (a bare boolean would be a new word carrying less).
- **Client re-reads the system of record and stops a repeat.** On a non-2xx body with `user_id`: keep the banner (it is the only place the sentence shows), `refetch()` the roster so the new row appears behind the dialog (D-212: the list endpoint resolves the role), disable Send Invitation (a repeat would re-POST the same email), and label the dismiss button "Close" (there is nothing left to cancel). Nothing-created: exactly today's behaviour (banner, Send enabled, "Cancel").
- No new copy sentences; no register row (amends the D-212 invite UI behaviour); no schema/DB.

## Tests (spec-listed only)
- BFF: the two created-but-incomplete tests assert `user_id === 'u-new'`; the W-F4 nothing-created test asserts the key is ABSENT (negative control).
- Client: (1) partial success → third GET fired, row from the re-read rendered, banner still shown, Send disabled, "Close" present; (2) nothing-created → no third GET, Send enabled, "Cancel" present (negative control, pins the untouched path).

## Files
- `src/app/api/account/users/route.ts` (catch block)
- `src/app/api/account/users/__tests__/route.test.ts`
- `src/app/account/users/users-table.tsx` (invite handler + dialog footer)
- `src/app/account/users/__tests__/users-table.test.tsx`
