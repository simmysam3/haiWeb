# Bootstrap — Execute the Agent Software page plan (subagent-driven)

Paste the prompt below into a fresh session (after `/clear`) to resume. All
context needed is in the spec + plan; nothing is implemented yet.

## State at handoff (2026-06-08)

- **Repo:** `/Users/samfleming/dev/hw/haiWeb` (Next.js 16 console)
- **Branch:** `v1.49` (independent off `master`; must be checked out)
- **Committed so far:** spec + plan + this bootstrap only — **no implementation code yet**
  - Spec: `docs/superpowers/specs/2026-06-08-agent-software-page-design.md`
  - Plan: `docs/superpowers/plans/2026-06-08-agent-software-page.md` (8 tasks, TDD)
- **Resume point:** Task 1. Progress is tracked by per-task commits — run
  `git log --oneline master..HEAD` to see which tasks are already committed and
  resume at the first uncommitted task.
- **Do NOT touch** `feat/agent-software-page` or `feat/portal-authcode-mfa`
  (unrelated concurrent auth work lives there).
- **Test/verify:** `npx vitest run <path>` per task; `npx tsc --noEmit`.
- **Post-implementation (manual, by the user):** drop a real
  `configuration-guide.pdf` into `private/agent-downloads/`, then
  `npm run build:agent-zip` to produce the zip + manifest.

## Paste-able prompt

> Work in `/Users/samfleming/dev/hw/haiWeb` on branch `v1.49` (check it out first;
> do not touch `feat/agent-software-page` or `feat/portal-authcode-mfa`).
>
> Execute the implementation plan at
> `docs/superpowers/plans/2026-06-08-agent-software-page.md` using the
> **superpowers:subagent-driven-development** skill — fresh subagent per task,
> two-stage review between tasks, commit per task (each commit message ends with
> the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer).
>
> Before starting, run `git log --oneline master..HEAD` and resume at the first
> task that isn't already committed. Follow each task's TDD steps exactly (write
> failing test → run/confirm red → implement → run/confirm green → commit).
> Honor the project's TDD rule. The spec is at
> `docs/superpowers/specs/2026-06-08-agent-software-page-design.md` if you need
> design rationale. After all 8 tasks, run the full suite (`npx vitest run`) and
> `npx tsc --noEmit`, and report the result.
