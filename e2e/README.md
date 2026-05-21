# HAIWAVE end-to-end walkthrough (Playwright)

This directory is the canonical home for the HAIWAVE Playwright walkthrough,
previously kept outside the repo at `C:/Users/SamFleming/test-walkthrough/`.
The spec exercises both HaiWeb pages/BFFs and haiCore endpoints, so it requires
a full local stack to be up before running.

## Quick start

1. Bring the stack up (separate terminals):

   ```sh
   # haiCore — gating must be enabled for §14.8/§14.9 seed flow
   cd C:/Users/SamFleming/haiCore
   ENABLE_TEST_SEED=true npm run dev

   # HaiWeb (this repo)
   cd C:/Users/SamFleming/HaiWeb
   npm run dev   # listens on :3001
   ```

   For Windows PowerShell, prefix with `$env:ENABLE_TEST_SEED='true';` before the
   haiCore `npm run dev`.

2. Export the test session env vars:

   ```sh
   export USER_EMAIL='<test-account-email>'
   export USER_PASSWORD='<test-account-password>'
   # required for §14.8 + §14.9 seed-driven tests; participant_id of USER_EMAIL
   export TEST_VENDOR_PARTICIPANT_ID='<uuid>'
   # optional overrides — defaults match the haiCore/HaiWeb dev ports
   export HAIWEB_BASE_URL='http://localhost:3001'
   export HAICORE_BASE_URL='http://localhost:3000'
   export HAIWAVE_PROTOCOL_VERSION='3.0.0'
   ```

3. Run the walkthrough:

   ```sh
   cd C:/Users/SamFleming/HaiWeb
   npm run test:e2e
   ```

## What's in here

`walk.spec.ts` — rolling test plan from v1.29 onward, with one `test.describe`
per v-release section (§1–§14 as of v1.35). New release cycles append a new
`§N` block; older sections stay byte-identical until a behavior change requires
an update.

## §14.8 / §14.9 seed harness

The accept / decline-with-reason tests need a pending `audit_scope` where the
logged-in user is the vendor. We create one via the gated haiCore endpoint
shipped alongside this walkthrough (v1.35 follow-up #6):

- `POST /api/v1/test/seed/pending-scope` — body `{ vendor_participant_id }`;
  returns `{ scope_id, initiator_participant_id, vendor_participant_id,
  acceptance_status: "pending" }`.
- `DELETE /api/v1/test/seed/:scopeId` — soft-disables the scope.

Both endpoints are only registered when haiCore was started with
`NODE_ENV=test` or `ENABLE_TEST_SEED=true`. In a production-shaped boot, the
route plugin throws at registration time and 404s if probed.

If `TEST_VENDOR_PARTICIPANT_ID` is unset, §14.8 + §14.9 are SKIPPED (with a
descriptive message) — the rest of the walkthrough runs normally.

## CI

CI integration is intentionally deferred. The full-stack bring-up (haiCore +
HaiWeb + 11 agent dev servers + Keycloak + Postgres) is heavier than the
existing GitHub Actions test job. For now, run locally as part of the
merge-verify gate.
