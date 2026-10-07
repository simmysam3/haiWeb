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
| `guide` | `configuration-guide.pdf` (+ `configuration-guide.json`) | `npm run render:guide-pdf` (renders the guide's markdown source through the print template, and records the PDF) |

The agent zip is a `git archive` of the haiClient `HEAD` (tracked files only;
secrets stay gitignored). The SDK ships **inside** that zip — there is no separate
SDK download.

## Release flow (fold into `/ship`)

1. **Agent zip:** `npm run build:agent-zip` → writes `haiwave-agent-v<version>.zip`
   + `manifest.json` (version comes from `../haiClient/package.json`). Run this
   against the haiClient commit you are releasing.
2. **Configuration guide PDF:** the PDF is rendered here from the guide's markdown source, haiCore
   `docs/client-implementation-guidelines-v<agent version>.md`, through the print template
   `design/configuration-guide/guide-template.html`.
   - **Render it:** back up the PDF that is served now, then run, in the tree the image is built from:
     `HAICORE_DIR=<haiCore checkout> npm run render:guide-pdf -- client-implementation-guidelines-v<agent version>.md`
     That one command converts the guide, prints it, replaces `private/agent-downloads/configuration-guide.pdf`
     (the file the download route serves) and records it: it writes `configuration-guide.json` beside the PDF,
     with the PDF's SHA-256, the edition, the source file and its SHA-256, and the record time. The console and
     `publish:help-pack` (step 4) read that record. The PDF and its record change together: a run that is
     refused leaves both as they were.
   - **It needs Playwright's Chromium:** `npx playwright install chromium`, once on the machine that renders.
   - **Render once for an edition.** Two renders of the same guide differ in the PDF's own time stamp, so the PDF's
     SHA-256 differs, and the help pack (step 4) names the PDF by that SHA-256. Once a pack built from this PDF has
     been evaluated, do not render again: a new render means a new publish to the rig and a new evaluation.
   - **A render that is stopped while it prints** can leave a file named
     `configuration-guide.pdf.<random>.rendering` in `private/agent-downloads/`. Delete it before the image is built:
     the image copies that directory as it stands.
   - **The template came from Claude Design once, and is not edited by hand.** It changes only by a new Claude
     Design run against the markup sample, `design/configuration-guide/guide-template-markup-sample.html`.
   - **A guide that uses anything outside the template's markup is refused, with the line number in the guide.**
     Nothing is guessed or left out. Correct the guide and run the command again; a new kind of element goes
     into the template first.
   - **`npm run record:guide-pdf` remains, for recording a PDF that was placed by hand:**
     `HAICORE_DIR=<haiCore checkout> npm run record:guide-pdf -- client-implementation-guidelines-v<agent version>.md`.
     It refuses, and writes nothing, when the PDF is missing, is empty or does not begin with `%PDF-`, or when it
     cannot read the source. Run it too if `render:guide-pdf` ever says that the PDF was replaced and its
     record was not made.
   ⚠ **Adopter-facing — configuration guide ONLY.** Do NOT make the platform
   As-Built spec (`haiCore/docs/<date>_as_built.md`) the source of this PDF: it is
   HAIWAVE-internal (DB schema, central services, prod deploy revisions, the
   security register) and would leak internal architecture to external adopters.
3. **Publish:** rebuild + redeploy the haiWeb prod image. The new
   `private/agent-downloads/` contents are baked in and served.
4. **Help pack (HAIWAVE Help, DESIGN-2026-10-03 §5.4):** after the deploy in step 3 is live, in the **same tree**:
   `npm run publish:help-pack -- --dry-run` (inspect `private/help-pack/help-pack.preview.json`), then
   `HAICORE_URL=<Central> HELP_PUBLISH_TOKEN=<haiwave_admin portal token> npm run publish:help-pack -- --publish`.
   - **The command takes exactly one argument, after npm's `--`: `--dry-run` or `--publish`.** A publish needs
     `--publish`, and a successful publish makes the pack active. Everything else is refused: exit 1, nothing
     assembled or sent, and the two forms printed. That is a run with no argument, any other argument (a misspelt
     one included), more than one argument, and `--publish` while npm holds a `--dry-run` of its own
     (`npm run publish:help-pack --dry-run -- --publish`).
     ⚠ npm keeps **every** flag typed before the `--` for itself (measured with npm 11.12.1: `--publish`, `--dryrun`,
     `--eval`, `-n`). Such a flag never reaches the command, so that run arrives as a run with no argument and is
     refused too: it no longer publishes. `npm run publish:help-pack --publish` without the `--` publishes nothing.
     Always type the `--`.
   - **`HAICORE_DIR`** (default `../haiCore`) is the haiCore checkout the command reads: the guide source and the
     as-built editions in `docs/`, the support brief in `docs/help/`, and the protocol version.
   - **The target Central must run with `HELP_AGENT_ENABLED=true`.** With the flag off,
     `PUT /api/v1/admin/help/packs` is not registered and the publish answers `HTTP 404`. The console's own
     `HELP_AGENT_ENABLED` can stay off until the pack is active.
   - It refuses unless the PDF in `private/agent-downloads/` is the one that was recorded and the guide source is
     unchanged since; the brief must carry the owner's `reviewed_by`.
   - Publish and evaluate on the rig first (`npm run help:eval` in haiCore apps/core). Production receives only a
     pack that matches the one that passed there. The manifest's `built_at` and `built_from` differ on every run,
     so these are the manifest fields that must equal the rig's: `guide.source_sha256`, `guide.body_sha256`
     (the served PDF's SHA-256), `agent.version`, `brief.file` and `console_pages_sha256`.

### Dependencies for step 2

*This section describes the retired haiWeb render (`build:guide-pdf`, `body.html`), which the release flow no longer uses.*

- Playwright Chromium (`npx playwright install chromium`) — HTML → PDF. (No
  markdown converter: the body is generated design-system HTML, not markdown.)
- The haiCore checkout at `HAICORE_DIR` (default `../haiCore`). The build reads the guide source the body names
  (`docs/<data-source>`) and refuses unless that file still hashes to the bound `data-source-sha256`.

Requires network. `build:guide-pdf` fails with an actionable message if Chromium
is missing — it never emits a stale/empty PDF silently.

### Authoring the body

*This section describes the retired haiWeb render (`build:guide-pdf`, `body.html`), which the release flow no longer uses.*

The template's header comment is the binding authoring contract for `{{body}}`
(page box, one-topic-per-page openers, the component class reference, the PIN
macro). Re-run the Claude authoring pass to refresh `body.html` whenever the guide
content changes, then re-run `build:guide-pdf`.
The automated path above replaces this once the template is in place.

## ⚠ Current state — production is behind the working tree

*The PDF is now rendered in the tree the image is built from with `npm run render:guide-pdf`, which records it as well (step 2). Where the text below says to re-run `npm run build:guide-pdf`, it names the retired render: run `npm run render:guide-pdf` there instead.*

Measured 2026-08-22 in the `guide-1.6` worktree and in `~/dev/hw/haiWeb`.

| Artifact | On disk (main checkout) | This worktree | Production |
|---|---|---|---|
| `haiwave-agent-v<version>.zip` | `haiwave-agent-v1.74.0.zip`, 2,157,791 B, built 2026-08-17 (`manifest.json` version `1.74.0`) | not built here | **NOT updated** |
| `configuration-guide.pdf` | 14,467,753 B, 41 pp, rendered 2026-08-17 (guide edition 1.5) | 17,221,951 B, 49 pp, rendered 2026-08-22 (guide edition 1.6) | **NOT updated** |

Both artifacts are gitignored, so neither travels with a commit and neither is in
this worktree unless it was produced here. The zip regenerates after the
`v1.76.0` tag; the PDF above is the edition-1.6 render. **Production keeps
serving the 2026-08-17 files until the haiWeb prod image is rebuilt and
redeployed from a tree that holds the finished artifacts** (steps 1–3) — that
rebuild is the owner's step and has not been taken.

**The edition-1.6 PDF exists only in the `guide-1.6` worktree.** It was rendered
there and, being gitignored, it does not travel with the commit and is not in the
main checkout. Whoever builds the prod image must re-run `npm run build:guide-pdf`
in the tree the image is built from, after this branch has merged — one command,
no network, Chromium already installed. Do not copy the file between trees; the
render is cheap and a copied artifact has no provenance.

## Regeneration log

> Point-in-time record of download regenerations. The artifacts themselves
> (`private/agent-downloads/*`, `private/design-intake/*`) are gitignored — this
> log is the tracked record of what was produced.

### 2026-08-22 — guide body re-authored to edition 1.6; PDF re-rendered (zip + prod pending)

- **Files:** `design/configuration-guide/body.html`, `design/configuration-guide/template.html`
  (the cover version card only), `design/configuration-guide/README.md`,
  `scripts/build-guide-pdf.mjs` (its docblock cite), and this file.
- **Guide body → edition 1.6:** `design/configuration-guide/body.html` re-authored
  from `haiCore/docs/client-implementation-guidelines-v1.6.md` at haiCore
  **`ff3f3da2`** — authored from `31c19cf3` and then followed forward through that
  edition's review round (`eebeede8`, `ff3f3da2`), which is where the guide file
  stands (`git log -1 -- docs/client-implementation-guidelines-v1.6.md`). The
  1.5 → 1.6 delta only. Eight new pages, 40 → 48
  `<section class="page">` blocks: §4.4a the seven native-quote variables,
  §4.4b the five settings the agent refuses to start on, §5.5 continued (the
  v1.76 Epicor mapping resources and the customer-pricing boundaries), §5.6
  document rendering, §7.7 native quotes (two pages), §7.8 quoting from chat
  (two pages). Changed in place: the change log, §5.3, §5.5, §6.10, §10.5,
  §10.6 (22 → 36 intents), §11.1, and the edition line. Section numbering is the
  PDF's own; the guide's § numbers are mapped into it.
- **Guide PDF RENDERED:** `npm run build:guide-pdf` →
  `private/agent-downloads/configuration-guide.pdf`, **17,221,951 B, 49 pages**
  (41 at edition 1.5). Every `<section class="page">` measured in Chromium under
  print emulation: **max height 1056 px, no page over the box** (the check was
  mutation-tested — a 600 px block injected into one page reported that page at
  1242 px). 49 pages = 48 body sections + the template cover, so no section
  spilled onto a second printed page.
- **Followed the guide's review round (`31c19cf3` → `ff3f3da2`, 17/17 lines).** The
  body-visible corrections: the seller's own console buttons **call the action
  directly** and only chat goes through the release/commit policy doors (§6.10,
  §7.7); the chat grant model replaces the old rank hierarchy — `hasGrant`, a
  `roles` array, the floor `quote_accept → quote_owner_outbound`, and the four
  grants stated as siblings-plus-owner rather than a hierarchy (§2.3, §10.6,
  §10.7); the prescribed transaction-touching chains are **13**, adding
  `quoteAttachPoChain` and `vendorQuoteStartChain` (§2.3, §5.4, §10.6, §10.7 —
  four sites carried the count); and the agent's own *Order Entry* tab is set in
  bold italic to distinguish it from a HAIWAVE-console breadcrumb.
- **Two standing corrections in the same pass.** `scripts/build-guide-pdf.mjs`'s
  docblock cited the retired `-v1.5.md` guide and now cites `-v1.6.md`; the
  §4.4 environment table no longer lists `SKU_PICKER_SCOPE`, which guide 1.6
  records as removed from the agent (`client-implementation-guidelines-v1.6.md:350`).
  ~~Note `body.html` §8.1 still documents that variable on a page this pass did not
  otherwise reopen — a known remaining instance.~~ *[2026-08-23: superseded the same
  day — the review fix below removed it from §8.1 too (R-EXEC-29); no `SKU_PICKER_SCOPE`
  remains anywhere in the PDF.]*
- **Review fixes (round 1).** The body's own provenance comment now names `ff3f3da2`
  as well as the `31c19cf3` it was authored from, so the file and this log agree on
  which guide commit it corresponds to and a future authoring pass diffs from the
  right one. The v1.6 change-log row, written before the review round landed, now
  also carries the two corrections that round brought — the chat grant model and the
  13-chain count — plus one sentence on the edition numbering, since the row sits
  directly under this document's own closed `v2.x` run. `SKU_PICKER_SCOPE` is gone
  from §8.1 as well as §4.4, so the variable guide 1.6 `:350` records as removed no
  longer appears anywhere in the PDF. One rank-era phrase in §1 became "grant floor";
  the `kit: role-floor` chip in §10.7 stays, because that is the test's name.
- **Agent zip: NOT regenerated.** It follows the `v1.76.0` tag on haiClient; the
  zip on disk is still `haiwave-agent-v1.74.0.zip`.
- **Production: NOT updated — the owner's image rebuild.** The artifacts are
  gitignored and baked in at image build time, so prod serves the 2026-08-17
  files until the haiWeb prod image is rebuilt and redeployed from a tree that
  holds both finished artifacts.
- **Cover edition corrected:** the template's cover card had hard-coded
  `Version 2.1` (`design/configuration-guide/template.html:367,369`), beside the
  parameterized `Edition: {{date}}` slot, so page 1 advertised version 2.1 while
  the body read edition 1.6 — the same defect guide edition 1.4 corrected once
  before, and the 2026-08-17 render carried it too. Both strings now read `1.6`.
  Nothing else in the template moved: the `<head>`, the inlined design tokens,
  the `.brand-logo` blob, the watermark `<defs>` and the numbering script are the
  fixed chrome its authoring contract names, and none of them was touched. **When
  the cover edition changes, this card must change with it.**

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

### 2026-08-23 — v1.76.1 artifacts (Plan 8 Task 11)
- **Agent zip:** `haiwave-agent-v1.76.1.zip` — 2,506,180 B, built 2026-08-23T05:43:56Z from the `v1.76.1` tag (haiClient merge 92833487; the `v1.76.0` tree could not be packaged — the denylist guard caught 15 demo-name fingerprints in 6 shipped files, scrubbed in haiClient #195 — Q-P8-14 (A)). `manifest.json`: `{ "version": "1.76.1", "zipFile": "haiwave-agent-v1.76.1.zip", "zipBytes": 2506180, "builtAt": "2026-08-23T05:43:56.746Z" }`. Guard: 0 leaks; `unzip -l`: 41 conformance tests ship, 0 other tests, one `.env.example`, no `.env.agent*`. The stale `haiwave-agent-v1.74.0.zip` removed.
- **Configuration guide PDF:** rendered 2026-08-23 from the merged body (haiWeb master 9a85c24, guide 1.6 @ haiCore ff3f3da2 — haiCore PR #343): 17,221,951 B, 49 pp (`/Count 49`; the cover reads Version 1.6).
- **Production: NOT updated.** These files are gitignored and baked at image build; the haiWeb prod image rebuild + Cloud Run redeploy are the owner's.
