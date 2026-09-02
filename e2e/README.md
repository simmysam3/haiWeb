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

## §17 inbox connector (v1.81) — needs its own throwaway agent

§17 covers the v1.81 inbox connector: `via_email` provenance on the Order Entry
drafts an inbox pull creates. It cannot run against the four rig agents — they
configure no `INBOX_CONNECTOR`, so `inboxPull` is null and `/admin/inbox-pull`
never registers. **Do not reconfigure the rig agents to make it run**; stand up a
throwaway agent instead.

1. Fixture directory — one message file plus its attachment bytes alongside
   (layout is documented in `mock-inbox-connector.ts`):

   ```sh
   mkdir -p /tmp/inbox-fixtures
   printf '%%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' \
     > /tmp/inbox-fixtures/PO_4512.pdf
   cat > /tmp/inbox-fixtures/po-4512.message.json <<'JSON'
   { "message_key": "<walk-po4512@example.test>",
     "subject": "Purchase Order 4512",
     "from": { "name": "Dana Buyer", "address": "dana.buyer@example.test" },
     "received_at": "2026-08-30T09:15:00.000Z",
     "attachments": [{ "file": "PO_4512.pdf", "declared_mime": "application/pdf", "is_inline": false }] }
   JSON
   ```

   `subject`, `from.name` and `from.address` are REQUIRED keys (nullable, not
   optional) — omitting one fails the schema and the message is skipped with a warn.

2. Start a haiClient agent on a free port with `INBOX_CONNECTOR=mock`,
   `INBOX_MOCK_DIR=/tmp/inbox-fixtures`, its own `DUCKDB_PATH`, and its own
   `CONFIG_DIR`. ⚠ **Use a FRESH DuckDB.** Migration `0022_inbox_intake` was
   amended in place, and migrations are recorded applied BY ID — a DB that
   applied the pre-merge 0022 silently lacks `last_failed_at` and the `draft_id`
   unique index and will never re-run it. Recreate such a DB; do not migrate it.
   A schema fault here presents as an inbox bug.

3. Export the three vars and run:

   ```sh
   export INBOX_AGENT_BASE_URL='http://localhost:8099'
   export INBOX_AGENT_TOKEN="$(curl -s -X POST localhost:8099/chat/login \
     -H 'content-type: application/json' \
     -d '{"username":"trader1","password":"<that agent password>"}' \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')"
   export INBOX_AGENT_ADMIN_KEY='<that agent ADMIN_API_KEY>'
   npx playwright test --grep '§17'
   ```

   The user needs the `quote_owner_inbound` grant (`trader1` in the stock
   `chat-users.json` has it). **The token dies when the agent restarts** — a
   401 mid-section usually means a stale token, not a product fault.

With any of the three unset, all five tests SKIP with a message naming what is
missing; the rest of the walkthrough runs normally.

**What §17 deliberately does NOT drive.** Extract and Commit are LLM-bound, and
an automated walk must not make billed calls. 17.3 asserts the badge through
`PATCH /api/v1/po-entry/:draftId` — the document surface's header edit, which
re-serialises through the same `draftPayload` that attaches provenance, and is
free. Note it is NOT the native-quote rename (`PATCH …/quote`): an inbox draft is
`source: document`, so that door answers 409 and can never exercise this.
**Extract→Commit therefore remains an OWNER-WALK item (F-3), not covered here.**

**Calibration (2026-08-31).** Verified against a deliberate mutant — `toViaEmail`
forced to return null, re-introducing §L-12(a) — which reddens **17.2 and 17.3**
and leaves 17.1/17.4/17.5 green. 17.4 staying green is correct, not a gap: it
asserts `via_email: null`, which the mutant also produces. A section that cannot
fail on purpose is not evidence, so re-run that check if these tests are reworked.

## CI

CI integration is intentionally deferred. The full-stack bring-up (haiCore +
HaiWeb + 11 agent dev servers + Keycloak + Postgres) is heavier than the
existing GitHub Actions test job. For now, run locally as part of the
merge-verify gate.
