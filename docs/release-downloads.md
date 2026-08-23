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
     (`haiCore/docs/client-implementation-guidelines-v1.6.md`) into the design-system
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

## ⚠ Current state — production is behind the working tree

Measured 2026-08-22 in the `guide-1.6` worktree and in `~/dev/hw/haiWeb`.

| Artifact | On disk (main checkout) | This worktree | Production |
|---|---|---|---|
| `haiwave-agent-v<version>.zip` | `haiwave-agent-v1.74.0.zip`, 2,157,791 B, built 2026-08-17 (`manifest.json` version `1.74.0`) | not built here | **NOT updated** |
| `configuration-guide.pdf` | 14,467,753 B, 41 pp, rendered 2026-08-17 (guide edition 1.5) | 17,217,911 B, 49 pp, rendered 2026-08-22 (guide edition 1.6) | **NOT updated** |

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
  `private/agent-downloads/configuration-guide.pdf`, **17,217,911 B, 49 pages**
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
  Note `body.html` §8.1 still documents that variable on a page this pass did not
  otherwise reopen — a known remaining instance.
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
