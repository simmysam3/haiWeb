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
2. **Configuration guide PDF:** the committed design template
   (`design/configuration-guide/template.html`, from Claude Design) has the fixed
   chrome + `{{title}}`/`{{date}}`/`{{body}}` slots. `{{body}}` is **generated
   design-system HTML** (a sequence of `<section class="page">` blocks per the
   authoring contract at the top of that template), **not** markdown:
   - **Author the body:** a Claude pass translates the source guide
     (`haiCore/docs/client-implementation-guidelines.md`) into the design-system
     markup per the contract, committed as `design/configuration-guide/body.html`
     (a first pass is in place).
   - **Assemble + render:** `npm run build:guide-pdf` injects title/date/body into
     the template and prints to `configuration-guide.pdf` via Playwright.
   ⚠ **Adopter-facing — configuration guide ONLY.** Do NOT make the platform
   As-Built spec (`haiCore/docs/<date>_as_built.md`) the `{{body}}`: it is
   HAIWAVE-internal (DB schema, central services, prod deploy revisions, the
   security register) and would leak internal architecture to external adopters.
3. **Publish:** rebuild + redeploy the haiWeb prod image. The new
   `private/agent-downloads/` contents are baked in and served.

### Dependencies for step 2

- Playwright Chromium (`npx playwright install chromium`) — HTML → PDF. (No
  markdown converter: the body is generated design-system HTML, not markdown.)

Requires network. `build:guide-pdf` fails with an actionable message if Chromium
is missing — it never emits a stale/empty PDF silently.

### Authoring the body

The template's header comment is the binding authoring contract for `{{body}}`
(page box, one-topic-per-page openers, the component class reference, the PIN
macro). Re-run the Claude authoring pass to refresh `body.html` whenever the guide
content changes, then re-run `build:guide-pdf`.
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
- **Design template wired:** the real Claude Design export is installed at
  `design/configuration-guide/template.html` (self-contained — inlined tokens +
  logo + watermark + page-numbering script; `{{title}}`/`{{date}}`/`{{body}}`
  slots). `build:guide-pdf` reworked to inject + render (no markdown step; the
  `marked` dependency is gone). A contract test fills the real template cleanly.
- **Guide body authored:** `design/configuration-guide/body.html` — a design-system
  first pass generated from the v2.1 guide (cover + TOC + 11 sections); a contract
  test asserts it assembles into the template with no leftover tokens.
- **Guide PDF RENDERED (2026-06-29):** installed Playwright Chromium (`npx playwright
  install chromium`) and ran `build:guide-pdf` → a **16-page, ~5.9 MB branded PDF**
  at `private/agent-downloads/configuration-guide.pdf`, replacing the stale Jun-9
  one. Verified visually: cover banner, auto-resolved TOC page refs, section
  openers, syntax-colored code, notes/cfg/planned callouts, the wave watermark +
  footer logo. (Long code lines were wrapped to avoid right-edge clipping.)
- **Production: NOT updated.** These artifacts are gitignored and baked into the
  image at build time, so prod keeps serving the old files until the haiWeb prod
  image is rebuilt + redeployed — and because they're gitignored, the regen must
  run in the same environment that builds the image (steps 1–3 above).
- **To finish:** `npx playwright install chromium`, `npm run build:guide-pdf`
  (verify each `.page` ≤ 1056px on first render; split/trim any overflow in
  `body.html`), then rebuild + redeploy the haiWeb prod image from that working tree.
