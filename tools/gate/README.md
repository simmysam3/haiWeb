# haiWeb combined gate

Parent design: `tools/gate/README.md` in the haiClient repo (the cross-repo design statement for
this practice) and `docs/superpowers/specs/2026-09-09-composite-release-regression-design.md` in
haiCore (the composite that consumes this gate). This file carries only what is specific here.

## What's here
- `combined-gate-haiweb.sh <base-sha> [<lane-branch> ...]` — orchestrator. Zero lanes is a valid
  call and is what a release-end run uses. Creates a throwaway detached worktree at the base,
  merges any lanes `--no-ff` in landing order, APFS-clones `node_modules` from `RIG` gated on
  lockfile equality, runs the measurement, and writes `runs/<UTC>/RECORD.md` with a standalone
  greppable `VERDICT=` line. Keeps the tree on anything but GREEN so a red can be inspected.
- `gate-haiweb.sh <tree> <outdir>` — the measurement: `next build`, then vitest.

## Process hygiene (not optional)

Run `haiCore/tools/gate/preflight.sh` **before and after** every invocation.

**Never run this gate concurrently with haiCore's or haiClient's.** Two full gates at once produced
three false reds in 15 minutes on 2026-09-01: a DuckDB `InternalException` inside a worker took the
run down with `ERR_IPC_CHANNEL_CLOSED` — no assertion failed and no summary printed — and every one
passed clean alone on a quiet machine. `release-gate.sh` therefore runs the three gates serially.

A crashed run strands tinypool workers at ppid 1, roughly 4.5 GB each (seven of them reached ~31 GB
and load average 42 on 2026-09-07). Dispose of them **by pid after confirming cwd**
(`lsof -a -p <pid> -d cwd`). Never `pkill node` — it takes down the agent fleet — and never
`pkill -f src/index.ts`, which matches haiCore's own entry point and kills Central.

Cloning ~580 MB of `node_modules` triggers Spotlight (`mdworker_shared`) indexing that took load
average from 3 to 17 on 2026-09-10 — enough for preflight to correctly refuse the next gate. The
orchestrator drops a `.metadata_never_index` marker in its throwaway tree for this reason; the rig
and any long-lived worktree should carry one too.

## haiWeb-specific invariants (not shared with the other two gates)

- **vitest is v4 and REJECTS `--minWorkers`.** haiCore and haiClient are vitest 3 and pass both
  `--maxWorkers=3 --minWorkers=1`. Copying that flag pair here aborts the run.
- **`retry: 2` is set in `vitest.config.ts`** (SWR cache bleed and async RSC render are
  concurrency-sensitive, per its own comment). A `(retry xN)` green is not a green, so the gate
  measures at `--retry=0` and captures the resulting FAIL lines as a named flake surface — triaged
  as flakes, not counted as defects, and not silently retried away either. Measured 2026-09-10:
  **zero FAIL lines at `--retry=0`**, so this policy currently costs nothing.
- **`.worktrees/` is already excluded in `vitest.config.ts`** (a v1.37 add; without it collection
  inflates roughly 3× across sibling worktrees). The gate asserts that config entry is still
  present as a PRESENT CONTROL — asserting "no worktree tests ran" would pass vacuously in a
  checkout that simply has no siblings.
- **DEPTH DEPENDENCY — the tree must be a direct child of `~/dev/hw`.** `@haiwave/protocol` is
  `file:../haiCore/packages/protocol` and resolves through a **relative** symlink
  `node_modules/@haiwave/protocol -> ../../../haiCore/packages/protocol`. Three levels up must land
  on `~/dev/hw`; one level deeper and the link dangles. This is the same class of failure
  haiClient's gate found with `seed-data/companies.json`. The gate asserts the link resolves, and
  asserts the enumeration count is non-zero *first*, so a broken glob cannot report "all links
  fine" over an empty set.
- **The build needs env placeholders.** `next build` sets `NODE_ENV=production`, and
  `src/config/env.ts` correctly refuses to load with the dev-default `SESSION_SECRET` or empty
  Keycloak secrets (five guards; four bite here). A fresh worktree has no `.env` — it is gitignored
  — so without them the build dies at "Collecting page data" with
  `SESSION_SECRET is the dev default but NODE_ENV=production`. The gate injects **throwaway
  placeholders** (randomised `SESSION_SECRET`, placeholder client secrets) rather than copying the
  launch tree's real `.env` into a throwaway tree: a gate needs the guards satisfied, not working
  credentials.
- **No `frontend/` split** — one build and one vitest run, unlike haiClient's two of each.
- **`RIG` defaults to `~/dev/hw/haiWeb-main-rig`** because haiWeb otherwise has exactly one
  worktree, so there is nothing existing to clone from. A wrong RIG cannot produce a false green:
  the lockfile-equality check stops the run with `BLOCKED(lockfile)`.
- **Never build in the launch tree.** `next build` writes `.next/`, and HaiWeb serves :3001 (and
  :3002) from it. Two builds in one `.next` produce a memory-vs-disk `buildId` mismatch on the live
  port.

## Verdicts

Four states, inherited verbatim from the other two gates — never add a fifth:

- `GREEN`
- `RED` — a real measured failure
- `SUSPECT(silent-pass:vitest)` — exit 0 with zero `✓` lines: nothing collectible ran
- `SUSPECT(retry:vitest)` — a `(retry xN)` green
- `BLOCKED(...)` — could not measure: `worktree-add`, `conflict:<paths>`, `node_modules`,
  `lockfile`, `protocol-symlink-dangling`, `worktrees-exclude-missing`,
  `vitest-aborted-no-summary` (a log with no summary block means the harness crashed — never a
  green)

## Baseline

Recorded 2026-09-10 against the rig at `016cb62a` (base-alone, no lanes), 97–107 s end to end:

| unit | files | tests |
|---|---|---|
| haiWeb | 388 passed (388) | 2485 passed (2485) |

Denominators are scoped to the tree that produced them and **do not travel** to a lane. Compare
*passed* counts across runs, never failures alone — a suite that fails at collection contributes 0
to the denominator, so totals are what move. **Passed must never go down.**
