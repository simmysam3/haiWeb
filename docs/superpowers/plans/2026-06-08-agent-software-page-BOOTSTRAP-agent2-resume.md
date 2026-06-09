# Bootstrap (RESUME) — AGENT 2: Agent Software page (subagent-driven)

> **This is AGENT 2's bootstrap.** Agent 2 owns the **Agent Software console page**
> feature on branch **`v1.49`**. A *different* agent (Agent 1) owns the
> Keycloak/auth-code/MFA work on branch **`feat/portal-authcode-mfa`** and has (or
> will have) its own bootstrap in this directory. **Do not cross the streams** —
> see the incident note below; the two were accidentally interleaved once already.

Paste the prompt at the bottom into a fresh session (after `/clear`) to resume.

## Identity & environment (READ FIRST)

- **Feature:** gated "Agent Software" page in the HaiWeb console (download the
  config-guide PDF + latest haiClient source zip, both auth-gated).
- **Branch:** `v1.49`.
- **⚠️ Work in the ISOLATED WORKTREE, not the main checkout:**
  - **Worktree (DO YOUR WORK HERE):** `/Users/samfleming/dev/hw/haiWeb-v1.49` → checked out to `v1.49`.
  - Main checkout `/Users/samfleming/dev/hw/haiWeb` is parked on `feat/portal-authcode-mfa` for **Agent 1** — **do not touch it**.
  - The worktree has `node_modules` and `.env` symlinked from the main checkout, so `npx vitest` / `npx tsc` work there directly.
  - Confirm before any commit: `git -C /Users/samfleming/dev/hw/haiWeb-v1.49 rev-parse --abbrev-ref HEAD` must print `v1.49`.
  - **Never run `git checkout`/`git switch`/`git branch`** in either location — branch switching in the shared `.git` is exactly what caused the incident.

## Why the worktree exists — the trampling incident (2026-06-08)

Two agents shared the single working copy. Agent 1 switched the shared HEAD to
`feat/portal-authcode-mfa` mid-run, so Agent 2's Task 2/3 commits landed on the
wrong branch and Agent 1's `fix(auth)` commit (`bbea1c8`) landed on top of Agent
2's nav commit. This was untangled by:
- cherry-picking Agent 2's Task 2 + Task 3 onto `v1.49` (where they belong),
- restoring `feat/portal-authcode-mfa` and re-seating Agent 1's auth work on its
  clean base (now commit `dec3681`, byte-identical content to the original `bbea1c8`),
- and isolating Agent 2 in the `haiWeb-v1.49` worktree so it can't happen again.
- **Safety net:** tag `backup/session-2026-06-08-portal-mfa` preserves the messy
  intermediate chain (recoverable if anything was lost). Leave it until both
  features are merged.

## Process (superpowers:subagent-driven-development)

Fresh **implementer** subagent per task → **spec-compliance** review → **code-quality**
review → fix loop until both pass → mark done → next task. Each subagent works in
the worktree on `v1.49`. Each commit message ends with the
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
Honor the project's red/green TDD rule (test → confirm red → implement → confirm green).

- Plan: `docs/superpowers/plans/2026-06-08-agent-software-page.md` (8 tasks)
- Spec: `docs/superpowers/specs/2026-06-08-agent-software-page-design.md`

## Known TDD gotcha (already hit twice — expect it again)

Tests that mock `node:fs/promises` with a named-import factory
(`vi.mock('node:fs/promises', () => ({ readFile, stat }))`) **fail under Vitest 4 +
the default jsdom env** (CJS-interop rewrites the named import to a default import).
Fix is a **per-file** `// @vitest-environment node` docblock on line 1 of that test
file. **Do NOT modify the global `vitest.config.ts`** — an earlier attempt to split
it into a `projects` array was reverted as over-engineered. This docblock is already
on the Task 3 and Task 4 test files; Task 7's build-script test will likely need it too.

## State at this handoff (2026-06-08)

Run `git log --oneline master..HEAD` to confirm. Committed on `v1.49`:

| Task | Commit | Reviews | Status |
|---|---|---|---|
| 1 — storage dir (`private/agent-downloads/`) | `4b36b56` | (config only) | ✅ done |
| 2 — nav link | `40dfc59` | spec ✅ quality ✅ | ✅ done |
| 3 — downloads lib (`src/lib/agent-downloads.ts`) | `2121708` | spec ✅ quality ✅ | ✅ done |
| 4 — gated download route | `e3349e1` | spec ✅ | ✅ done |
| 4-fix — basename-guard manifest zip name (path-traversal hardening from review) | `f582b0c` | quality ✅ → re-review ✅ RESOLVED | ✅ done |
| 5 — `DownloadCard` component | `9f1202a` | **NOT YET REVIEWED** | ⚠️ committed, reviews pending |

**RESUME POINT → Task 5's two reviews are outstanding.** The implementer committed
`9f1202a` (impl follows the plan; the implementer adapted styling to the repo's
design tokens from `card.tsx`/`button.tsx` — `border-slate/15`, `bg-white`,
`text-charcoal`, `bg-navy hover:bg-charcoal`, `bg-light-gray text-slate` — while
keeping the asserted texts `Download` / `Not yet published` and the props interface
intact; verify this in spec + quality review). Then continue:

- **Task 5 (finish):** dispatch spec-compliance review, then code-quality review of `9f1202a` (base `f582b0c`). Fix-loop if needed.
- **Task 6:** Agent Software page `src/app/account/agent-software/page.tsx` — no unit test; verify with `npx tsc --noEmit`. Note: the plan's page imports `PageHeader` from `@/components/page-header` (exists; props `title` + optional `description`), `DownloadCard`, and `loadManifest`/`fileExists`. The spec also calls for a `getSession()` redirect-to-login gate on the page — the plan's snippet omits it; reconcile (the route is gated regardless, but the spec wants the page gated too).
- **Task 7:** build script `scripts/build-agent-zip.mjs` + test (TDD) + `package.json` `build:agent-zip` script; then run the real build once and verify the zip excludes secrets. (Build shells out to `../haiClient` via `git archive`.)
- **Task 8 / final:** `npx vitest run` (full suite) + `npx tsc --noEmit`, then a final whole-feature code review, then **superpowers:finishing-a-development-branch**.

## Paste-able prompt

> You are **Agent 2**, resuming the **Agent Software page** feature. Read
> `docs/superpowers/plans/2026-06-08-agent-software-page-BOOTSTRAP-agent2-resume.md`
> first — it has the full state, the worktree setup, and the trampling-incident guardrails.
>
> **Work ONLY in the worktree `/Users/samfleming/dev/hw/haiWeb-v1.49` on branch `v1.49`.**
> Do NOT touch `/Users/samfleming/dev/hw/haiWeb` (Agent 1's `feat/portal-authcode-mfa`).
> Never run `git checkout`/`switch`/`branch`. Confirm `rev-parse --abbrev-ref HEAD == v1.49`
> before every commit.
>
> Execute `docs/superpowers/plans/2026-06-08-agent-software-page.md` using the
> **superpowers:subagent-driven-development** skill (fresh subagent per task, spec
> review then code-quality review, commit per task with the
> `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer; project red/green TDD).
>
> Run `git log --oneline master..HEAD` to confirm progress. Tasks 1–4 (+ a Task-4
> security fix) are complete and reviewed. **Task 5 (`DownloadCard`, commit `9f1202a`)
> is committed but its spec + code-quality reviews are NOT done — start there**, then
> do Tasks 6–8. Tests that mock `node:fs/promises` need a `// @vitest-environment node`
> docblock (do NOT edit the global `vitest.config.ts`). After all tasks, run
> `npx vitest run` + `npx tsc --noEmit`, do a final whole-feature review, and finish
> with superpowers:finishing-a-development-branch. Report results.
