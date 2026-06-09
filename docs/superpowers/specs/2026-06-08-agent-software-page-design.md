# Agent Software page (HaiWeb console) — Design

**Date:** 2026-06-08
**Status:** Approved
**Scope:** A new "Agent Software" page in the signed-in HaiWeb console that lets a
logged-in partner download (a) the agent configuration guide PDF and (b) a zip of
the latest haiClient agent source. Both downloads are gated behind authentication.

## Goal

Make the agent deployable by partners: from the console, a signed-in user can
reach **Agent Software** in the nav, read a short page, and download the
**configuration guide (PDF)** and the **latest agent source (zip)**.

## Non-goals

- No public/marketing distribution (downloads are gated to signed-in users).
- No automatic CI publishing of the zip — it is produced by a build script run
  per agent release.
- No authoring of the configuration guide; the PDF is provided by the user.
- No versioned archive/history of past agent zips — only "latest" is served.

## Decisions (confirmed)

1. **Zip production:** a build script (`git archive`) → static file on disk,
   regenerated per release.
2. **Config guide PDF:** user-provided file dropped into the storage dir.
3. **Access:** the page lives in the signed-in console nav; **downloads are
   gated through an authenticated API route** (not static `public/` files).
4. **Nav placement:** a standalone **"Agent Software"** section at the bottom of
   the console nav.
5. **Storage path:** `haiWeb/private/agent-downloads/` (outside `public/`).
6. **Build script:** lives in HaiWeb, shells out to `../haiClient`.

## Components

### 1. Nav link — `src/components/account-nav.tsx`
Append a new `NavSection` at the **end** of `navSections`:
```
{ label: "Agent Software", items: [
    { href: "/account/agent-software", label: "Agent Software",
      tooltip: "Download the agent configuration guide and the latest agent client software." }
]}
```
Covered by the existing `account-nav.test.tsx` (extend it to assert the link).

### 2. Page — `src/app/account/agent-software/page.tsx`
- Server component using the standard console page shell (mirrors existing
  `/account/*` pages: same layout wrapper, heading, card styling).
- Calls `getSession()` from `@/lib/auth`; if `null`, redirect to the login route
  (same pattern other gated account pages use).
- Reads `private/agent-downloads/manifest.json` (server-side `fs`) for the zip
  version + build date, and determines each file's availability by checking the
  filesystem directly (`configuration-guide.pdf` fixed name; zip name from the
  manifest):
  - **Configuration Guide (PDF)** download button → `/api/agent-software/download/guide`
  - **Agent — Latest Version (v<version>)** download button →
    `/api/agent-software/download/agent`, with version + build date.
- A file that is missing — or a missing/absent `manifest.json` (no build run yet)
  — renders that button disabled with a "Not yet published" note; the page still
  renders.

### 3. Gated download route — `src/app/api/agent-software/download/[file]/route.ts`
- `GET`. Calls `getSession()`; returns **401** JSON if `null`.
- `params.file` validated against an allowlist map:
  - `guide` → `configuration-guide.pdf`, `application/pdf`
  - `agent` → `haiwave-agent-v<version>.zip` (resolved from manifest), `application/zip`
  - Any other value → **400**. The allowlist (not raw user input) determines the
    on-disk filename, so there is no path traversal surface.
- Resolves the file under `private/agent-downloads/`. If missing → **404** JSON.
- Streams the file with `Content-Type` and
  `Content-Disposition: attachment; filename="…"`.

### 4. Storage — `haiWeb/private/agent-downloads/`
Outside `public/`, so files are **not** statically served and are only reachable
through the gated route. Contents:
- `configuration-guide.pdf` — provided by the user.
- `haiwave-agent-v<version>.zip` — produced by the build script.
- `manifest.json` — `{ version, zipFile, zipBytes, builtAt }` (zip metadata only;
  the PDF is user-provided and detected by filesystem presence, not the manifest).
A `.gitignore` in this dir ignores the PDF and zip (binaries) but keeps a
`.gitkeep` so the directory exists. `manifest.json` may be committed or ignored;
default: ignored (it references build artifacts).

### 5. Build script — `scripts/build-agent-zip.mjs` (HaiWeb)
- Resolves the haiClient repo path from `AGENT_SOURCE_REPO` env, default
  `../haiClient` (relative to HaiWeb root).
- Reads `<haiClient>/package.json` `version`.
- Runs `git -C <haiClient> archive --format=zip -o
  private/agent-downloads/haiwave-agent-v<version>.zip HEAD`.
  - **Secret-safe by construction:** `git archive` includes only tracked files;
    `.env*`, `data/`, `*.duckdb`, `node_modules/`, `dist/` are gitignored and
    therefore excluded.
- Writes `manifest.json` (version, zip filename, byte size, `builtAt` timestamp).
- Fails loudly if the haiClient path is missing or not a git repo, or if the
  working tree resolution fails.
- Wired as an npm script, e.g. `"build:agent-zip"`.

## Data flow

```
Console nav "Agent Software"
   → /account/agent-software (server, getSession() gate)
       reads manifest.json → renders two gated download buttons
   → user clicks → GET /api/agent-software/download/{guide|agent}
       → getSession() ? stream file from private/agent-downloads : 401
```

## Security

- Downloads never live under `public/`; only the authenticated route can read them.
- `getSession()` (Keycloak `haiwave_session` cookie) gates both the page and the route.
- The route maps an allowlisted `file` key to a fixed on-disk name — no
  user-controlled path segments reach the filesystem.
- The zip is built via `git archive` (tracked files only) → no `.env`, no
  database files, no credentials.

## Error handling

| Condition | Behavior |
|---|---|
| Unauthenticated page request | redirect to login |
| Unauthenticated download request | 401 JSON |
| `file` not in allowlist | 400 JSON |
| Requested file not on disk | 404 JSON; page shows button disabled ("Not yet published") |
| `manifest.json` absent (no build run yet) | page renders both buttons disabled; agent download route 404s |
| Build script: missing/invalid haiClient repo | non-zero exit, clear error |

## Testing (TDD)

- **Download route** (`route.test.ts`): 401 without session; 200 + correct
  `Content-Type`/`Content-Disposition` with a session and present file; 404 when
  the file is absent; 400 for a non-allowlisted `file`. Mock `getSession` and `fs`.
- **Nav** (`account-nav.test.tsx`): renders the "Agent Software" link at `/account/agent-software`.
- **Page**: renders both download links and the version label from a mocked manifest;
  shows the disabled/"not yet published" state when a file is missing.
- **Build script**: a focused test (or smoke) asserting the produced archive
  excludes `.env*`/`node_modules`/`data` and includes `package.json` — run against
  a tiny fixture git repo, or assert the `git archive` invocation + manifest output.

## File inventory

| File | Change |
|---|---|
| `src/components/account-nav.tsx` | add bottom "Agent Software" nav section |
| `src/components/__tests__/account-nav.test.tsx` | assert new link |
| `src/app/account/agent-software/page.tsx` | new gated page |
| `src/app/api/agent-software/download/[file]/route.ts` | new gated download route |
| `src/app/api/agent-software/download/[file]/__tests__/route.test.ts` | route tests |
| `scripts/build-agent-zip.mjs` | new build script |
| `private/agent-downloads/.gitkeep` + `.gitignore` | storage dir |
| `package.json` | `build:agent-zip` script |
```
