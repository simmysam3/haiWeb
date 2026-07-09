# Strip the demo/prospect fingerprint from the distributed agent archive

**Date:** 2026-07-09
**Status:** Design — awaiting review
**Repos touched:** haiClient (strip/scrub/demote), haiWeb (build guard)

## Problem

The console "HAIWAVE Agent — Source Archive" download is built by
`haiWeb/scripts/build-agent-zip.mjs` via `git archive HEAD` on the haiClient
repo. `git archive` bundles **every tracked file** (excluding only gitignored
paths: `data/`, `*.duckdb`, `.env*`, `node_modules`). haiClient tracks a large
demo/prospect footprint — real company sample data (Amphenol, Apex, Beta, EG4,
SEL, Gore, Great Lakes, Huntwood, Lyn-Tron, Precision, Summit, TI, US Steel,
Delta Flow…), per-company config manifests, BOM fixtures, facility data with
hardcoded participant UUIDs, and demo seed scripts. All of it currently ships to
every adopter who downloads the agent. **We must not distribute this**, while
keeping it in the repo for local demo builds.

## The rule (from the product owner)

The axis is **mechanism vs. company sample data**, not file names:

- **Keep** functional/additive elements that we support long-term — even if they
  were accidentally labelled "vomero" or live near demo code. Functionality is
  never collateral damage.
- **Strip** anything that is purely one company's sample data — CSG, Nike, OIA,
  and every prospect company above (products, customers, pricing, orders,
  facilities, BOMs, UUIDs, product-prefix profiles, convenience aliases,
  worked-example names in comments).
- **Do not resurrect** anything from the thrown-out demo branch. "Keep" means
  what is currently in `main` as real functionality — nothing deleted comes back.

"Vomero" is an unreliable signal: some vomero-labelled constructs are real
functional protocol types; strip by *content* (does it embed company sample
data?), never by the label.

## Approach

Three coordinated mechanisms, with a **fail-closed guard as the guarantee** —
because no hand-built list can be proven complete by inspection.

### 1. `.gitattributes` `export-ignore` (haiClient)

Git's native "keep the file tracked in the repo, omit it from `git archive`"
flag. Local builds, `dev:*` scripts, and local seeding are completely untouched
— the files stay on disk and in git; the distributed zip simply omits them. No
change to `build-agent-zip.mjs`'s core `git archive` call.

Constraint: `export-ignore` is whole-file. A stripped file must not be
referenced by any file that still ships (a static import to a missing module
breaks the adopter's `tsc` build). Files with a live shipping reference are
handled by source scrub (#2) or the demote (below), not export-ignore.

### 2. Source scrub (haiClient)

Files that must ship but embed a company name get genericised in place:

- `package.json` — remove the company-named `dev:*` aliases (`dev:selinc`,
  `dev:amphenol`, `dev:huntwood`, `dev:ussteel`, `dev:ti`, `dev:hotstart`). The
  generic `dev:agent1..13` aliases stay.
- `packages/client-sdk/src/chat/sub-intent-executor.ts` — the comment worked
  example ("after an Amphenol search…") becomes a generic vendor.
- `.dockerignore` — drop the `config/posture-config-selinc.json` line (dead once
  that path is export-ignored, but remove for cleanliness / guard-green).
- Any additional file the guard surfaces.

### 3. The `seed-lead-time-history` demote (haiClient — code change)

`seedLeadTimeHistory` is welded into the shipping boot path and embeds company
sample data (`LINE_PROFILES` keyed to company product-prefixes; `BUYER_PIDS` =
four hardcoded company UUIDs) and — a latent hygiene bug — **runs
unconditionally on startup**, so any adopter agent with products fabricates ~180
days of fake order history keyed to our prospects' prefixes.

Decision: **demote to a local script.**
- Remove `src/app.ts:48` import and `src/app.ts:307` boot call.
- Remove the `packages/reference-agent/src/index.ts:12` barrel re-export.
- Relocate `packages/reference-agent/src/db/seed-lead-time-history.ts` to
  `scripts/seed-lead-time-history.ts` as a standalone runnable (constructs its
  own db adapter / participant id / logger, matching the other `seed:*` scripts).
- Add `npm run seed:leadtime`. Run it locally when demo history is wanted.
- `export-ignore` `scripts/seed-*.ts` (covers the relocated file).

This matches the repo's existing `seed:origin` / `seed:multilevel` /
`seed:demo:agents` convention and removes the fabricate-on-boot wart from real
deployments.

### 4. The fail-closed guard (haiWeb — the guarantee)

Extend `scripts/__tests__/build-agent-zip.test.ts`: after building the zip,
extract it to a temp dir and assert:

1. **Name denylist grep** over the extracted tree fails the build on ANY hit.
   Denylist = the prospect/demo names + demo UUIDs:
   `amphenol, apex, beta, eg4, sel/selinc, deltaflow, gore, great lakes,
   huntwood, lyntron/lyn-tron, precision plastics, summit electrical, us steel,
   midwest, national industrial, pacific safety, nike, oia, csg`, and the four
   `BUYER_PIDS` UUIDs. Case-insensitive, word-boundary-aware to limit false
   positives (`beta`, `oia`, `csg` need boundaries).
2. **Path assertions** — none of the export-ignored paths appear in the zip.
3. **Build-verify** — the extracted archive `npm ci && npm run build` (`tsc -b`)
   compiles clean, proving nothing shipping references a stripped file.

Iterate export-ignore/scrub until the guard is green. The guard — not the
enumerated list — is what proves the artifact is clean.

Boot-smoke (extract → configure → `npm start` → health check) is a heavier
manual/CI step, run once at implementation, not part of the unit test.

## What stays (functional — confirmed no company data or already gated)

- `packages/reference-agent/src/db/seed-watcher-demo-data.ts` — unconditionally
  creates the `capacity_state` / `delivery_events` tables (mechanism); demo rows
  are gated behind `SEED_DEMO_DATA`, off by default; contains zero company names.
- `haicore-protocol/dist/vomero/*` — functional readiness/backlog/events protocol
  types (the "accidentally vomero-labelled" additive functionality). The only
  company references are Nike/OIA/CSG in doc-comment prose. To let the guard run
  strict, scrub that prose at the haiCore protocol **source**
  (`haiCore/packages/protocol/src/vomero/*`) and re-sync the vendored copy
  (`npm run sync:protocol`) — a comment-only change. (Renaming the "vomero"
  label itself is out of scope here.)

## Candidate strip-list (starting point — guard confirms completeness)

`export-ignore`:
```
seed-data/
config/operations-manifests/
config/pricing-manifests/
config/posture-config-selinc.json
scripts/bom-fixtures/
scripts/seed-*.ts
scripts/lib/vendor-facilities.ts
scripts/count-products.ts
seed-products.mjs
test-environment/
```
Source scrub: `package.json`, `.dockerignore`,
`packages/client-sdk/src/chat/sub-intent-executor.ts`.
Code change: the `seed-lead-time-history` demote (§3).

## Open recommendation (not blocking)

`scripts/` and `test-environment/` are largely HAIWAVE-internal fleet/demo
tooling (classification restore, checkpointing, hotstart verification, company
generation) that adopters do not need. Rather than denylist-scrub each, consider
a mostly-allowlist posture for these two dirs in a follow-up: default-exclude,
re-include only the handful an adopter genuinely runs. This design ships the
denylist-driven strip first (safe, guard-verified); the allowlist tightening is
a separate pass.

## Verification

1. Guard test green (denylist + path + build-verify).
2. Manual boot-smoke of the extracted archive.
3. `git ls-files` sweep for the denylist over the *would-ship* set returns empty.
4. Local build + `dev:*` + `npm run seed:leadtime` still work (nothing local
   regressed).

## Testing note

Per repo TDD: the guard test is written red first (build a zip from the current
tree → denylist grep fails), then export-ignore/scrub/demote until green. The
demote's relocated script gets a smoke test that it seeds against a temp DuckDB.
