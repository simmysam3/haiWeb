# haiWeb backlog — mock-data-as-real & silent-fallback remediation

Deferred from the 2026-07-03 v1.56 audit. These are **product/feature work** (wiring UI to real BFF/haiCore endpoints, or gating mock data behind a dev flag), not cleanup — held out of the audit's hardening pass because they need backend endpoints and/or product decisions, not a mechanical fix. Each authenticated surface below ships hardcoded data or fire-and-forget mutations that present fabricated state as real.

## Theme A — pages render mock data as live account state
- **[high]** `src/app/admin/health/page.tsx:35` — Admin console pages silently render hardcoded mock data when the API fails
  - Fix: Track an error state per page, render an explicit failure banner instead of the mock constants (or initialize data to null and gate rendering), and keep mock seeds for development only.
- **[medium]** `src/app/account/agents/agents-panel.tsx:66` — Authenticated production pages render hardcoded mock data as if real (pattern)
  - Fix: Wire these panels to the BFF/haiCore or hide them behind a development-only flag; at minimum remove the fake credential-issuance flow from the agents page.
- **[medium]** `src/app/account/page.tsx:11` — Account dashboard renders fabricated MOCK_* data as live account state
  - Fix: Wire these tiles to the live BFF endpoints that already exist (/api/account/partners, /api/account/connections) and hide or clearly gate the billing/agent tiles that have no backend yet, instead of substituting mock data.
- **[medium]** `src/app/account/page.tsx:35` — Account dashboard renders mock agents/partners/invoices/requests unconditionally
  - Fix: Route each panel through the existing BFF endpoints (agents, partners, connections, billing) with mock data only as dev fallback, and drop the hardcoded trends.
- **[medium]** `src/app/account/usage/_components/usage-client.tsx:84` — CompositionBar is wired with hardcoded zeros so the modality breakdown is always empty
  - Fix: Pass real per-modality hop counts (the timeseries/counterparty endpoints already expose audit/watcher/phantom_demand splits) or remove the widget until the data is plumbed; hoist CurrentPayload into _components/types.ts.
- **[medium]** `src/app/admin/participants/page.tsx:14` — /admin console runs on hardcoded mock data with no-op admin actions
  - Fix: Fetch participants from the BFF and call /api/admin/actions for suspend/reactivate; keep mock data only as the dev fallback via useApi.
- **[medium]** `src/components/company-profile-modal.tsx:41` — Active/Pending status pill fabricated from business_type
  - Fix: Remove the StatusBadge on line 41 and keep the plain business_type text (or pill an actual status field if one exists on the request).

## Theme B — fire-and-forget mutations (success shown regardless of server outcome)
- **[high]** `src/app/account/partners/partners-panel.tsx:164` — Remove Partnership never persists — partner reappears on reload
  - Fix: Add a BFF route that proxies connection removal to haiCore and call it from handleRemove, or remove the Remove button until the operation is supported.
- **[high]** `src/app/account/users/users-table.tsx:84` — Fire-and-forget mutations with unconditional success toasts across the legacy account portal
  - Fix: Check res.ok on every mutation, roll back the optimistic state and show an error toast/banner on failure; reserve the success toast for a confirmed 2xx. The ban/deactivate/payment actions should be fixed first.
- **[medium]** `src/app/account/partners/partners-panel.tsx:128` — Pattern: fire-and-forget mutations show success toast regardless of server outcome
  - Fix: Await each response, check res.ok, and on failure revert the optimistic update and show an error message (a small shared mutate helper would cover all call sites).

## Theme C — silent prod fallback / data-shape issues
- **[high]** `src/app/account/agents/agents-panel.tsx:70` — Agent registration fabricates credentials client-side and never calls the backend
  - Fix: Back register/decommission with real BFF routes (or remove the actions and show read-only agent state from haiCore); delete the fabricated env-config generation and the no-op ternaries.
- **[medium]** `src/app/api/admin/dashboard/route.ts:10` — Admin dashboard allowlist mismatch: /admin/abuse and /admin/analytics can never fetch real data
  - Fix: Add 'abuse' and 'connections' to DASHBOARD_TYPES and drop 'suspicious'/'failed_submissions' if nothing will request them; alternatively surface the 400 in the pages instead of falling back silently to mocks.
- **[medium]** `src/lib/library-types.ts:8` — Library artifact/attribute rows are camelCase JSON inside an otherwise snake_case payload
  - Fix: Fix haiCore's library view to hand-map rows to snake_case per protocol, then rename these two interfaces, their consumers, and the dev mock in the same release; a haiWeb-only rename would break against the live API.
- **[medium]** `src/lib/use-api.ts:51` — Client useApi hook silently substitutes mock fallback data on fetch errors in production
  - Fix: In production, surface the error state (data: null + error) instead of the fallback, reserving the mock substitution for NODE_ENV !== 'production'.

## Highest priority
1. `agents-panel.tsx:70` (HIGH) — fabricates HAIWAVE_CLIENT_SECRET credentials client-side and presents them as one-time real keys; also uses the wrong domain haiwave.io. Either wire register/decommission to real BFF routes or make it read-only; delete the fake credential generation.
2. `partners-panel.tsx:164` + `users-table.tsx:84` (HIGH) — Remove-partnership / user-deactivate show success but never persist (or ignore res.ok). Check res.ok, roll back optimistic state on failure, reserve the success toast for a confirmed 2xx.
3. `admin/health|audit|abuse` (HIGH) — silently render MOCK_* when the API fails; render an explicit failure banner instead, keep mock seeds dev-only.

Full 187-finding audit context was in the session scratchpad `AUDIT_REPORT.md` (ephemeral). Security items from the same audit were applied (compliance register D-53…D-65).