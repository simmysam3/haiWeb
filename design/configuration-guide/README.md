# Configuration-guide PDF template

This directory holds the **design template** that turns the configuration-guide
markdown into the branded `configuration-guide.pdf` served on the console
download page. It exists so the published PDF can be regenerated deterministically
in the release flow instead of being hand-exported from Claude Design each time
(which silently drifts from the source).

## Files

- `template.html` — the HTML scaffold with `{{title}}` / `{{date}}` / `{{body}}`
  placeholders. **Currently a stub** — replace with the Claude Design export.
- `theme.css` — stub print styles (brand tokens). The Claude Design export may
  replace this or inline its own `<style>`.

## The one-time Claude Design ask

To move Claude Design from a per-release manual step to a one-time template
source, ask it to:

> Export the configuration guide's design as a **single self-contained HTML
> template** with placeholders `{{title}}`, `{{date}}`, and `{{body}}` (body =
> where the rendered guide content goes). Use only those three placeholders.

Paste the result into `template.html` (keep the three placeholders verbatim).
After that, every release renders the current markdown through this template with
no manual Design step.

## How it's consumed

`scripts/build-guide-pdf.mjs` renders the source markdown → HTML (`marked`),
injects it into `template.html` (`injectTemplate`, unit-tested), and prints to
PDF via Playwright/Chromium. The injector **fails loudly** if the template
contains any placeholder other than the supported three, so a renamed/typo'd
placeholder can never ship an empty section.

See `../../docs/release-downloads.md` for the full release flow, and
`npm run build:guide-pdf`.

## Requirements to actually render

- `marked` (`npm i -D marked`) — markdown → HTML.
- Playwright Chromium (`npx playwright install chromium`) — HTML → PDF.

Both require network; the script emits an actionable error if either is missing.
