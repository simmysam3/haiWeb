# Bootstrap: Restore the Audit tiered gap-count + priority-scoring UI

**Slot:** agent1 (HaiWeb). **Repo:** `C:/Users/SamFleming/HaiWeb` (frontend only — no backend/protocol change).
**Branch:** `v.1.45-agent1`. **Authored:** 2026-05-31 from a systematic-debugging investigation.

---

## TL;DR

The audit **run-detail** page used to show, per supply-chain TIER (T1 / T2 / T3 / T4+),
a **gap count bar** and a **weighted follow-up priority score** (T1×5, T2×3, T3×2, T4+×1),
with SKUs grouped under their tier-1 vendor and ranked by score. That UI was **deleted in
v.1.39** (commit `d2863b0`, 2026-05-22) when the run-detail page was rewritten to "view-only:
header, summary, evidence tree." It was never restored. This is a real code deletion, not a
data or wiring gap.

**The scoring logic still exists** in the shared module `src/components/sonar/observations/gap-tier.tsx`
(extracted in `4bc981d`, currently consumed ONLY by the Watcher modality). The audit result
data the UI needs (`AuditRunResult[]` with per-node `depth_level` + `gap`) is **intact** and
already fetched by the current page. So restoration is a **frontend rewire**: re-add a
tier-breakdown + score panel to the audit run-detail page, computing buckets from the result
tree using the shared `gap-tier.tsx` helpers.

---

## Evidence (verified via git history + live code)

| Commit | Date | Event |
|---|---|---|
| `504e881` | 2026-05-15 | **Created** `src/app/account/sonar/audit/runs/[id]/products-grid.tsx` — *"audit gaps-by-tier bar + weighted priority queue. Segment gaps by depth tier (1/2/3/4+), weighted follow-up score (T1×5 T2×3 T3×2 T4+×1), group SKUs under tier-1 vendor."* This IS the feature. |
| `1ee8d7a` | 2026-05-20 | Moved audit `/compliance` → `/posture`; products-grid moved with it. |
| `d2863b0` | 2026-05-22 (v.1.39) | **Deleted it.** Run-detail rewritten to view-only (header + summary + full-width evidence tree). `products-grid.tsx` dropped; route dir renamed `runs/[id]` → `[run_id]`. |
| `4bc981d` | 2026-05-26 | Extracted `tierBucket`/`scoreOf`/`GapTierBar`/`ScorePill`/`priorityBand` → shared `src/components/sonar/observations/gap-tier.tsx`. Only Watcher (`src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx`) was wired to it. Audit never got it back. |

To read the original component verbatim:
```
git -C C:/Users/SamFleming/HaiWeb show 504e881:src/app/account/sonar/audit/runs/[id]/products-grid.tsx
```

**NOT the cause:** the v.1.45 catalog-rationalization / PD-overhaul churn did NOT remove this.
A `git diff master..v.1.45` on the audit pages is clean — the loss predates v.1.45 (v.1.39).
Also note: the backend `GET /api/v1/audit-coverage` endpoint is a *different* thing (flat
company/class/product booleans, no tiers) — do not confuse it with this client-side, per-run
tiered scoring. No backend change is required.

---

## What to restore

Re-add a **"Gaps by tier / follow-up priority"** panel to the audit run-detail page:

- **Mount point:** `src/app/account/sonar/audit/[run_id]/page.tsx`. Add the new panel
  in the `{showTree && (...)}` block, ABOVE or beside the existing `<EvidenceTreePanel>`
  (the page already has `results: AuditRunResult[]` in scope — see the `TREE_STATUSES`
  fetch). Keep the evidence tree; this panel is additive.
- **New component:** `src/app/account/sonar/audit/[run_id]/_components/tier-gap-grid.tsx`
  (`'use client'`). Port the original `ProductsGrid` but **import the scoring helpers from the
  shared module instead of re-declaring them inline** (the original predates the extraction):
  ```ts
  import { tierBucket, scoreOf, mergeTiers, worstTier, GapTierBar, ScorePill }
    from '@/components/sonar/observations'; // barrel re-exports gap-tier.tsx
  ```
  Drop the original's inline `tierBucket`/`TIER_POINTS`/`scoreOf`/`mergeTiers`/`worstTier`/
  `tierStyle`/`GapTierBar`/`ScorePill` copies — they now live in the shared module. Keep the
  audit-specific bits: `gapsByTier(node)` (recursive bucket of `node.gap` by
  `tierBucket(node.depth_level)` over `node.components`), the per-SKU rows, the
  group-by-tier-1-vendor logic, score-desc ordering, search box, and the per-row
  "View tree" / root-blocking-gap affordance.

### Data shapes (verified, protocol `@haiwave/protocol`)
- `AuditRunResult`: has `tree: ObservationNode`, `product_id: string`,
  `vendor_participant_id: string`, `geo_rollup: [...]` (the original used `r.geo_rollup.length`
  for a "Countries" column — keep or drop at your discretion).
- `ObservationNode` (`packages/protocol/src/audit/traversal.ts`): `depth_level: number`,
  `gap: AuditGap | null`, `components: ObservationNode[]`, `vendor_legal_name?: string | null`,
  `payload` (discriminated union; audit branch carries `origin.vendor_name`).
  → vendor name resolution in the original:
  `r.tree.vendor_legal_name ?? (r.tree.payload.kind === 'audit' ? r.tree.payload.origin.vendor_name : null) ?? ''`.
- Persisted subtrees are rooted at a depth-1 child, so `depth_level` maps directly to "Tier N".
  `tierBucket` clamps `>=4` into the "4+" rollup bucket.

### Shared module API (`src/components/sonar/observations/gap-tier.tsx`, re-exported via the barrel)
`tierBucket(depthLevel)`, `tierLabel(tier)`, `tierPoints(tier)` (T1=5/T2=3/T3=2/T4+=1),
`scoreOf(Map<tier,count>)`, `mergeTiers(into,from)`, `worstTier(tiers)`, `tierStyle(tier)`,
`priorityBand(tiers)`, `<GapTierBar tiers={...} />`, `<ScorePill score tiers />`.

---

## Acceptance criteria
1. On `/account/sonar/audit/[run_id]` for a `complete`/`partial` run, a tier panel renders:
   per-SKU + per-vendor gap-by-tier bar (T1..deepest) + weighted ScorePill, vendors ordered
   by cumulative score desc, SKUs within a vendor by score desc.
2. Uses the shared `gap-tier.tsx` helpers (no duplicated tier/score logic).
3. Evidence tree still renders (panel is additive, not a replacement).
4. Empty/clean runs (no gaps) render gracefully (em-dash / score 0), not a crash.
5. `npm run build` + `npx tsc --noEmit` clean; add/adapt a vitest for the grid
   (the original had `runs/[id]/__tests__` coverage — mirror it).
6. Verify live on the running demo: trigger or open an apex depth-3 audit run; confirm
   T2/T3 gap counts + scores appear (the demo's multi-tier origin-manifest depth was
   re-seeded 2026-05-31, so apex audit runs now traverse ≥3 tiers).

## Verification data note
A depth-3 **watcher** run already demonstrates tiered gaps exist in the data
(`watcher_results` had 237 `redacted_gap` rows at tiers 2–3 after the 2026-05-31 reseed).
For audit, open/trigger an apex audit run with depth ≥3 and confirm the new panel populates.

## Out of scope (do not bundle)
- No backend or `@haiwave/protocol` change.
- Do NOT touch the Watcher counterparties-grid (it already has its own working ScorePill).
- The portfolio-wide "vendors we have no audit coverage of across all runs" scorecard is a
  SEPARATE, larger feature (would need new backend tier-coverage aggregation) — not this.
  This bootstrap restores the **per-run** tiered gap scoring that was deleted.

## Slot / process
agent1, HaiWeb only. One PR `v.1.45-agent1 → v.1.45`, body `## Summary` + `## Test plan`.
Follows the standing test-fix-cycle process (see memory `test-fix-cycle-integration-branch`).
