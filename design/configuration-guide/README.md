# Configuration-guide PDF template

> **Status.** The served PDF is rendered from the guide's markdown source with
> `npm run render:guide-pdf`, which also records it (see `../../docs/release-downloads.md`).
> This folder now holds:
>
> - `guide-template.html`: the print template that command fills. It came from Claude
>   Design and has six slots, each written as its name inside double curly braces:
>   `lang`, `title`, `cover_line`, `version`, `date` and `body`. It is changed only by a
>   new Claude Design run against the markup sample, never by hand.
> - `guide-template-markup-sample.html`: the contract between the converter
>   (`scripts/guide-markdown.mjs`) and the template. It shows every element and class
>   the converter emits, and the template styles nothing else.
> - `template.html` and `body.html`: the retired haiWeb render (`npm run build:guide-pdf`).
>   The rest of this file describes that render.

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
(`haiCore/docs/client-implementation-guidelines-v1.6.md`, the canonical guide): translate the guide's
content into the design-system markup per the contract, then stage it as
`body.html` (committed alongside this template). A first pass is in place; re-run
the authoring pass to refresh it whenever the guide changes.

## Source binding (HAIWAVE Help, DESIGN-2026-10-03 §5.4)

The help agent answers from the **full source markdown of the edition the PDF
was rendered from**, so the body must say exactly which source it came from.
The **first** `<section class="page">` in `body.html` carries three attributes
(HTML comments are ignored when finding it, so a commented-out section never counts):

- `data-edition="1.7"`: the guide edition (it must equal the version in the file name);
- `data-source="client-implementation-guidelines-v1.7.md"`: the haiCore `docs/` file authored from;
- `data-source-sha256="<64 hex>"`: `shasum -a 256` of that file at authoring time.

`npm run build:guide-pdf` refuses to render when any attribute is missing, or
when `$HAICORE_DIR/docs/<data-source>` (default `../haiCore`) no longer hashes
to `data-source-sha256`. An in-place edit of the source therefore forces a
re-author before the next PDF. On success it writes
`private/agent-downloads/configuration-guide.json`
(`{ bodySha256, edition, sourceFile, sourceSha256, builtAt }`) beside the PDF.
The console BFF and `npm run publish:help-pack` read that file. Since the Claude
Design route, `npm run record:guide-pdf` writes that file, with `bodySha256` = the
served PDF's SHA-256.

The PDF keeps its own section numbering (owner ruling B, 2026-10-03). The help agent cites guide
sections by title, so no numbering rule changes here.

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
