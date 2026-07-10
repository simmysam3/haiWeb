# Default-deny allowlist for the agent archive

**Date:** 2026-07-10
**Status:** Design — approved, pre-spec-review
**Repos touched:** haiWeb (build mechanism + invariant test), haiClient (.gitattributes, package.json)
**Builds on:** the shipped fingerprint-strip work (haiClient #85, haiWeb #132, haiCore #255). This is deferred follow-up #2 from that effort.

## Problem

The distributed agent archive is built denylist-style: `git archive HEAD` ships every tracked file, minus `export-ignore`d demo data. The fail-closed guard catches company-name *fingerprints*, but it cannot catch files that are **internal but unnamed** — they carry no company token, so nothing flags them. These currently ship to adopters:

- `CLAUDE.md` — HAIWAVE-internal Claude Code dev instructions
- `kill-agents.ps1`, `kill-all.ps1` — internal fleet-kill scripts
- `deploy-agent.sh` — internal fleet-deploy automation (references `seed-data/<company>`, `.env.agentN`, `haiCore/seed-data/companies.json`)
- `docs/typed-memory.md` and internal `scripts/` (`sync-protocol`, `inspect-schema`, `query-origin-manifests`, `verify-hotstart-*`, `import-gathered-agent`)

Denylist is default-allow: a future internal file ships until someone notices. We want default-deny.

## Approach

Switch the archive build to an explicit **allowlist**: `git archive HEAD -- <allowlist>`, where the allowlist is a maintained constant in `haiWeb/scripts/lib/agent-archive-allowlist.mjs`. Only enumerated paths ship; everything else is excluded by default. The existing demo-data `export-ignore` rules **stay** as defense-in-depth for demo content *inside* shipped dirs (e.g. `config/operations-manifests/`, demo BOM fixtures). The two mechanisms compose: the allowlist picks top-level include paths; `export-ignore` removes demo data within them; the denylist guard backstops both.

### Allowlist (ship)

Determined by tracing what the build (`tsc -b`), the Docker image (`Dockerfile`), and the runtime (`docker-entrypoint.sh`) actually need, plus adopter-facing meta:

- Code/build: `src/`, `packages/`, `haicore-protocol/`, `frontend/`, `public/`, `config/`
- Manifests/build config: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `vitest.config.ts`
- Container: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and the three Dockerfile-required scripts `scripts/docker-entrypoint.sh`, `scripts/seed-config.mjs`, `scripts/hash-chat-password.mjs` (entrypoint runs seed-config, which imports hash-chat-password)
- Adopter docs/meta: `README.md`, `UPGRADING.md`, `CHANGELOG.md`, `LICENSE`, `.env.example`, `.gitignore`

`.gitattributes` is deliberately **not** shipped — it enumerates our excluded internal paths (a roadmap of what we hold back). `git archive` reads `.gitattributes` from the tree to *apply* the `export-ignore` rules regardless of the pathspec, so omitting it from the allowlist drops the file from the output while its rules still function.

### Excluded by default (not in the allowlist)

`CLAUDE.md`, `.gitattributes` (excluded-paths roadmap), `kill-agents.ps1`, `kill-all.ps1`, `deploy-agent.sh`, `docs/`, all other `scripts/*`, `seed-data/`, `test-environment/`, `e2e/`, `seed-products.mjs`, and (gitignored anyway) `data/`, `dist/`, `node_modules/`.

### Tests — conformance kit only

Per the configuration guide §11.6, the adopter-facing executable is the **conformance kit** at `packages/client-sdk/src/__tests__/conformance/` (17 protocol-behavior tests + `fakes.ts`; self-contained — imports only `@haiwave/protocol`, deps, and its own files). Ship that kit; exclude every other test.

Mechanism (in haiClient `.gitattributes`): **content-glob** `export-ignore` on test patterns, then un-ignore the conformance dir entry itself *and* its contents (later, more-specific rules win). Directory-prune patterns (`**/__tests__/`) do NOT work here — git archive won't descend into a pruned dir, so the nested un-ignore is never evaluated and the kit ships zero files. Use `/**` globs and un-ignore the dir entry before its contents:
```
tests/**                                            export-ignore
**/__tests__/**                                     export-ignore
**/*.test.ts                                         export-ignore
**/*.spec.ts                                         export-ignore
packages/client-sdk/src/__tests__/conformance       -export-ignore
packages/client-sdk/src/__tests__/conformance/**    -export-ignore
```
This **supersedes** the 30 per-file demo-test `export-ignore` entries added in follow-up #1 — remove them (redundant once all non-conformance tests are excluded).

**Docker-seed exception:** the `Dockerfile` COPYs `config/pricing-manifests/company-default.example.json` (a config *template*, not demo data) as an image seed, but `config/pricing-manifests/ export-ignore` strips it — an already-live bug that breaks adopter `docker build`. Re-include just that file: `config/pricing-manifests/company-default.example.json -export-ignore`. Verification must include a Dockerfile-COPY-target presence check, since `tsc` alone never exercises the image.

### Adopter conformance runner

Add to haiClient `package.json` scripts:
```
"test:conformance": "vitest run packages/client-sdk/src/__tests__/conformance/"
```
Matches the existing `test` style. The guide §11.6 currently documents the raw `npx vitest run packages/client-sdk/src/__tests__/conformance/`; updating the guide (haiCore doc + PDF regen) to reference `npm run test:conformance` is a **separate follow-up**, not part of this change.

## Two-sided safety

- **Over-inclusion** (a fingerprint slips into a shipped path): the existing fail-closed denylist guard in `build-agent-zip.mjs` catches it (unchanged).
- **Under-inclusion** (the allowlist accidentally drops a needed file): a lightweight archive-content invariant test in `build-agent-zip.test.ts` (or a sibling) that builds a zip from the real repo and asserts:
  - **present:** `src/`, `packages/`, `haicore-protocol/`, `package.json`, `Dockerfile`, the three required scripts, and `packages/client-sdk/src/__tests__/conformance/` (a conformance file)
  - **absent:** `CLAUDE.md`, `.gitattributes`, `kill-agents.ps1`, `deploy-agent.sh`, any `docs/` entry, and a non-conformance test (e.g. a `tests/` file)

No slow extract-and-build in the test loop (matches the "not much testing" intent). A one-time manual/CI full extract-and-`tsc` remains the belt-and-suspenders check when the allowlist changes materially.

## Where it lands

The archive PRs (#85 haiClient, #132 haiWeb) are open and unmerged and touch these exact files (`.gitattributes`, `build-agent-zip.mjs`, `package.json`). This change stacks onto those same branches (`chore/strip-demo-fingerprint`, `chore/agent-archive-guard`) so it ships as part of the same review, rather than a separate PR against not-yet-merged work.

## Verification

1. `AGENT_SOURCE_REPO=../haiClient node build-agent-zip.mjs` → `Built ...`, guard green.
2. Archive top-level contains only allowlisted entries; `CLAUDE.md`/`kill-*`/`deploy-agent.sh`/`docs/` absent; conformance kit present; no non-conformance tests present.
3. Every `Dockerfile` COPY source path is present in the archive (esp. `config/pricing-manifests/company-default.example.json`) — `tsc` never exercises the image, so this is a distinct check.
4. `npm run test:conformance` in haiClient runs the kit green.
5. The invariant test passes (present + absent assertions).
6. One-time: extract the archive and `tsc -b` to confirm the allowlist didn't drop a build input.

## Non-goals

- Guide/PDF regeneration to reference `npm run test:conformance` (separate follow-up).
- Any change to what the conformance kit asserts.
- Reworking the demo-data `export-ignore` rules (they stay as defense-in-depth).
