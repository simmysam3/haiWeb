# Configuration-guide PDF template

The served PDF is rendered from the guide's markdown source with `npm run render:guide-pdf`,
which also records it (see `../../docs/release-downloads.md`). This folder holds:

- `guide-template.html`: the print template that command fills. It came from Claude
  Design and has six slots, each written as its name inside double curly braces:
  `lang`, `title`, `cover_line`, `version`, `date` and `body`. It is changed only by a
  new Claude Design run against the markup sample, never by hand. One exception: the
  cover wave's `opacity:.5`, set by hand on 2026-10-07 so the wave stays an accent. A new
  run keeps it; a test pins it.
- `guide-template-markup-sample.html`: the contract between the converter
  (`scripts/guide-markdown.mjs`) and the template. It shows every element and class
  the converter emits, and the template styles nothing else. Its text is filler.

## The record beside the PDF

`render:guide-pdf` writes `private/agent-downloads/configuration-guide.json`
(`{ bodySha256, edition, sourceFile, sourceSha256, builtAt }`) beside the PDF.
`bodySha256` is the served PDF's SHA-256. The console BFF and
`npm run publish:help-pack` read that file. `npm run record:guide-pdf` writes the same
record for a PDF that was placed by hand.

## Boundary

Adopter-facing: the configuration guide ONLY. The platform As-Built spec
(`haiCore/docs/<date>_as_built.md`) is HAIWAVE-internal and is never the source of
this PDF.

## The earlier render

Until October 2026 this folder also held `template.html` and `body.html`, and
`npm run build:guide-pdf` printed that authored HTML body. That render was replaced by
`render:guide-pdf` and removed with its files.

See `../../docs/release-downloads.md` for the full release flow.
