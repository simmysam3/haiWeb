# Releasing the console downloads (agent + configuration guide)

The console download page (*Account > Agent Software*, served by
`src/app/api/agent-software/download/[file]`) is the **definitive source** for
the Free Agent client and the configuration guide. This is how its artifacts are
produced and published.

## What the page serves

Both files live in **`private/agent-downloads/`** (gitignored — never committed).
The production image bakes that directory in at build time
(`infrastructure/docker/Dockerfile.prod` COPYs it into the runtime image, and the
download route reads it from `process.cwd()/private/agent-downloads` at runtime).
So: **put the finished files there, then rebuild + redeploy the haiWeb prod image
→ they are live.**

| Download key | File | Produced by |
|---|---|---|
| `agent` | `haiwave-agent-v<version>.zip` (+ `manifest.json`) | `npm run build:agent-zip` |
| `guide` | `configuration-guide.pdf` | `npm run build:guide-pdf` (or a manual Claude Design export) |

The agent zip is a `git archive` of the haiClient `HEAD` (tracked files only;
secrets stay gitignored). The SDK ships **inside** that zip — there is no separate
SDK download.

## Release flow (fold into `/ship`)

1. **Agent zip:** `npm run build:agent-zip` → writes `haiwave-agent-v<version>.zip`
   + `manifest.json` (version comes from `../haiClient/package.json`). Run this
   against the haiClient commit you are releasing.
2. **Configuration guide PDF:** stage the dated source markdown in
   `private/design-intake/` and run `npm run build:guide-pdf`:
   - `private/design-intake/configuration-guide.md` — the current guide
     (`haiCore/docs/client-implementation-guidelines.md`), date appended.
   - `private/design-intake/as-built.md` — the latest dated as-built
     (`haiCore/docs/<M-DD>_as_built.md`).
   The script renders markdown → the committed design template
   (`design/configuration-guide/template.html`) → `configuration-guide.pdf`.
3. **Publish:** rebuild + redeploy the haiWeb prod image. The new
   `private/agent-downloads/` contents are baked in and served.

### Dependencies for step 2

- `marked` (`npm i -D marked`) — markdown → HTML.
- Playwright Chromium (`npx playwright install chromium`) — HTML → PDF.

Both require network. `build:guide-pdf` fails with an actionable message if either
is missing — it never emits a stale/empty PDF silently.

### Fallback: manual Claude Design export

Until the Claude Design template export is pasted into
`design/configuration-guide/template.html` (see that dir's README), you can keep
the manual path: hand the dated `configuration-guide.md` + `as-built.md` to Claude
Design, and drop the returned PDF in as `private/agent-downloads/configuration-guide.pdf`.
The automated path above replaces this once the template is in place.

## ⚠ Current state — artifacts are stale

As of this writing the published artifacts are **`v0.1.0` / 2026-06-09**, while
haiClient is **v1.50.0** and the guide is **v2.1** — i.e. the page advertises
"latest" but serves a pre-refactor agent and a pre-v2.0 guide. **Before the next
release, regenerate both** (steps 1–3) so the download reflects v1.50.0.

## Regeneration log

> Point-in-time record of download regenerations. The artifacts themselves
> (`private/agent-downloads/*`, `private/design-intake/*`) are gitignored — this
> log is the tracked record of what was produced.

### 2026-06-28 — agent zip refreshed to v1.50.0 (PDF + prod redeploy still pending)

- **Agent zip:** `npm run build:agent-zip` → `haiwave-agent-v1.50.0.zip`. Manifest:
  `{ "version": "1.50.0", "zipFile": "haiwave-agent-v1.50.0.zip", "zipBytes": 2183167, "builtAt": "2026-06-28T18:48:23Z" }`.
  Stale `haiwave-agent-v0.1.0.zip` removed. Verified the archive contains the
  current workspace (top-level `README.md`, `packages/client-sdk` + `reference-agent`,
  the conformance kit) and excludes `node_modules`/`.env`/`*.duckdb`.
- **Design-intake staged** (gitignored): `configuration-guide.md` (from
  `haiCore/docs/client-implementation-guidelines.md`, v2.1) and `as-built.md`
  (from `haiCore/docs/6-11_as_built.md`, the latest on disk).
- **Guide PDF: NOT regenerated.** `npm run build:guide-pdf` is blocked — `marked`
  is not installed (and Chromium isn't either), and `design/configuration-guide/template.html`
  is still the Claude Design stub. The existing branded-but-stale PDF was left
  untouched (the script fails before writing).
- **Production: NOT updated.** These artifacts are gitignored and baked into the
  image at build time, so prod keeps serving the old files until the haiWeb prod
  image is rebuilt + redeployed — and because they're gitignored, the regen must
  run in the same environment that builds the image (steps 1–3 above).
- **To finish:** `npm i -D marked` + `npx playwright install chromium`, paste the
  Claude Design export into the template, `npm run build:guide-pdf`, then rebuild +
  redeploy the haiWeb prod image from that working tree.
