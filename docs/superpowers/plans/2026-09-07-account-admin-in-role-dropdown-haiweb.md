# Offer `account_admin` in the Role dropdown (HaiWeb v1.89 PR 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Invite and Edit dialogs offer `account_admin`, with a label and a definition from the one vocabulary, so a user holding that role no longer shows a blank Role select when edited.

**Architecture:** Three one-line vocabulary additions. `ROLES` in `src/app/account/users/role-select.tsx` gains the id; `PILL_DEFINITIONS.status` in `src/components/pill.tsx` gains its definition; `STATUS_LABELS` in `src/components/status-badge.tsx` gains its label. The existing census in `role-select.test.tsx` (every offered role resolves a definition and is assignable) is the RED: adding the id alone fails the definition half.

**Tech Stack:** React client component, Vitest + Testing Library.

**Spec:** Owner ruling 2026-09-07 (verbatim in `haiweb-review-2026-09-04/owner-rulings-2026-09-05.md`): "on account_admin - offer it." Allocation: `~/dev/hw/ALLOCATION-2026-09-07-account-admin-offer-agent1.md` (HaiWeb v1.89 PR 2; no D-row, no register revision). Facts: `account_admin` is in `ASSIGNABLE_USER_ROLES` (`src/lib/auth.ts:61`) and `hasRole` grants it admin-level portal settings access (`auth.ts:235-241`); the realm SSOT (`haiCore infrastructure/keycloak/haiwave-realm.json`) defines it as "Company admin: portal settings + library/manifest mutations (BFF role gate)".

## Global Constraints

- Worktree `/Users/samfleming/dev/hw/haiWeb-account-admin`, branch `account-admin-role` on origin/master **54485eca**. `git -C …` and `(cd … && …)` only; never a bare `cd`; never `npm install`; do not push.
- TDD one test at a time: RED for the stated reason, then the smallest change, then GREEN. Test command: `npx vitest run --maxWorkers=3 <path>` (haiWeb vitest REJECTS `--minWorkers`).
- UI copy is plain: no commercial ERP names; no "BFF"; definition in the vocabulary's house style (a short sentence ending in a period, like `procurement_transact: 'Procurement role permitted to transact.'`).
- The census `src/__tests__/no-role-attribute.test.ts` must not be tripped (no `attributes` object carrying `role`).
- One commit per task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: `account_admin` offered, defined, labelled

**Files:**
- Modify: `src/app/account/users/role-select.tsx:6-15` (the `ROLES` array)
- Modify: `src/components/pill.tsx` (`PILL_DEFINITIONS.status`, beside `account_owner` at ~:99)
- Modify: `src/components/status-badge.tsx` (`STATUS_LABELS`, beside `account_owner` at :8)
- Test: `src/app/account/users/__tests__/role-select.test.tsx`

**Interfaces:**
- Produces: `ROLES` = `["account_admin", "procurement_read_only", …]` (account_admin first: it is the highest-privilege assignable role, mirroring the priority order in `src/lib/auth.ts:93-101`); `definitionFor('status', 'account_admin')` → `'Account administrator; manages portal settings, the library and manifests.'`; `STATUS_LABELS.account_admin` → `'Account Admin'`.

- [ ] **Step 1: RED — add the id to `ROLES` and watch the census fail on the definition half**

In `src/app/account/users/role-select.tsx` make the array:

```ts
export const ROLES = [
  "account_admin",
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
] as const;
```

Run: `(cd /Users/samfleming/dev/hw/haiWeb-account-admin && npx vitest run --maxWorkers=3 src/app/account/users/__tests__/role-select.test.tsx)`
Expected: FAIL in 'every option in ROLES resolves a definition from the pill vocabulary' with the message `account_admin` (the assignability test stays green: `isAssignableRole('account_admin')` is already true).

- [ ] **Step 2: GREEN — the definition**

In `src/components/pill.tsx`, inside the `status` block directly after the `account_owner` line:

```ts
    account_admin: 'Account administrator; manages portal settings, the library and manifests.',
```

Run the same command. Expected: PASS (all tests).

- [ ] **Step 3: RED — the option label**

Add to `role-select.test.tsx`:

```tsx
  it('offers Account Admin with its definition', () => {
    render(<RoleSelect id="invite-role" value="account_admin" onChange={() => {}} />);
    // An explicit label: the fallback title-case would read "Account admin".
    expect(screen.getByRole('option', { name: 'Account Admin' })).toBeInTheDocument();
    expect(screen.getByText('Account administrator; manages portal settings, the library and manifests.')).toBeInTheDocument();
  });
```

Run. Expected: FAIL — no option named exactly "Account Admin" (the fallback renders "Account admin").

- [ ] **Step 4: GREEN — the label**

In `src/components/status-badge.tsx`, directly after `account_owner: 'Owner',`:

```ts
  account_admin: 'Account Admin',
```

Run. Expected: PASS.

- [ ] **Step 5: Affected suites, lint, commit**

Run: `(cd /Users/samfleming/dev/hw/haiWeb-account-admin && npx vitest run --maxWorkers=3 src/app/account/users src/components src/__tests__/no-role-attribute.test.ts)` — expected all green (the users-table suite renders `RoleSelect`; the pill/status-badge suites, if any, still pass).
Lint: `npx eslint src/app/account/users/role-select.tsx src/components/pill.tsx src/components/status-badge.tsx src/app/account/users/__tests__/role-select.test.tsx` — 0 problems.
Commit the four files:

```
feat(users): offer account_admin in the Role dropdown, with its label and definition

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

## Self-review

Spec coverage: the ruling "offer it" = the id in the dropdown (Step 1), readable (Step 4), defined at the dropdown per D1 of the users-lifecycle design (Step 2). No placeholders. Names match across steps. Not in scope: any change to `ASSIGNABLE_USER_ROLES`, `hasRole`, the BFF, or the realm.
