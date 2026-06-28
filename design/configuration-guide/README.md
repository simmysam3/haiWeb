# Configuration-guide PDF template

`template.html` is the **HAIWAVE Configuration Guide render template**, exported
from Claude Design. It is self-contained — inlined design tokens, the brand-logo
blob, the wave-watermark `<defs>`, and the page-numbering script are fixed chrome
and must round-trip untouched. The pipeline fills three string placeholders:

- `{{title}}` — document title (cover banner + `<title>`).
- `{{date}}` — edition / build date (cover).
- `{{body}}` — the document body.

## ‹body› is generated design-system HTML, not markdown

Per the authoring contract embedded at the top of `template.html`, `{{body}}` is
a sequence of `<section class="page">` blocks written in the design system's
vocabulary (`.sec-open`, `.h3`, `.p`, `.tbl` with status cells, `.code`, `.note`,
`.planned`, `.cfg`, …) — one `<section class="page">` per printed US-Letter page,
with overflow split across pages. It is **not** the output of a markdown
converter, so the pipeline does no markdown step.

The body is produced by a **Claude authoring pass** from the source guide
(`haiCore/docs/client-implementation-guidelines.md`): translate the guide's
content into the design-system markup per the contract, then stage it as
`body.html` (committed alongside this template). A first pass is in place; re-run
the authoring pass to refresh it whenever the guide changes.

## How it's consumed

`scripts/build-guide-pdf.mjs` injects `{{title}}`/`{{date}}`/`{{body}}` into this
template (`injectTemplate`, unit-tested — including a contract test that fills
*this* committed template cleanly), then prints to PDF via Playwright/Chromium.
`injectTemplate` fails loudly if the template ever introduces a placeholder other
than the supported three.

```
npm run build:guide-pdf            # reads design/configuration-guide/body.html → private/agent-downloads/configuration-guide.pdf
```

## Requirements to actually render

- Playwright Chromium (`npx playwright install chromium`) — HTML → PDF. (Requires
  network; the script emits an actionable error if it is missing.)

## Boundary

Adopter-facing: the configuration guide ONLY. Never make the platform As-Built
spec (`haiCore/docs/<date>_as_built.md`) the `{{body}}` — it is HAIWAVE-internal.

See `../../docs/release-downloads.md` for the full release flow.
