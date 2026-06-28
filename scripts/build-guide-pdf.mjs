import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Generate `configuration-guide.pdf` by injecting a generated body into the
 * self-contained HAIWAVE design template and rendering to PDF.
 *
 * The template (`design/configuration-guide/template.html`, exported from Claude
 * Design) is fixed chrome — inlined design tokens, the logo blob, the wave
 * watermark, the page-numbering script, and a parameterized cover — with three
 * string placeholders: `{{title}}`, `{{date}}`, `{{body}}`.
 *
 * ‹body› is NOT markdown. Per the template's authoring contract it is a sequence
 * of `<section class="page">` blocks written in the design system's vocabulary
 * (.sec-open / .h3 / .p / .tbl / .code / .note / .planned / .cfg …). That body
 * is produced by a Claude authoring pass from the source guide
 * (`haiCore/docs/client-implementation-guidelines.md`) — so this build step does
 * NO markdown conversion; it only assembles + renders.
 *
 * Only `injectTemplate` runs without an external dependency (and is unit-tested,
 * including against the real committed template). `renderPdf` needs Playwright +
 * an installed Chromium; it fails with an actionable message when absent, so the
 * build degrades loudly (never silently produces an empty/stale PDF).
 */

const PLACEHOLDERS = { title: 'title', date: 'date', bodyHtml: 'body' };

/**
 * Substitute {{title}} / {{date}} / {{body}} in the template. Every required
 * field must be provided, and NO {{…}} may remain afterward (a leftover means the
 * template used a placeholder this generator doesn't fill — fail loudly).
 *
 * @param {string} template
 * @param {{ title: string, date: string, bodyHtml: string }} fields
 * @returns {string}
 */
export function injectTemplate(template, fields) {
  let out = template;
  for (const [field, token] of Object.entries(PLACEHOLDERS)) {
    const value = fields?.[field];
    if (value == null) {
      throw new Error(`injectTemplate: missing required field "${field}" (for {{${token}}})`);
    }
    out = out.split(`{{${token}}}`).join(value);
  }
  const leftover = out.match(/\{\{\s*([\w.-]+)\s*\}\}/);
  if (leftover) {
    throw new Error(
      `injectTemplate: unfilled placeholder {{${leftover[1]}}} — the template uses a ` +
        `placeholder this generator does not provide. Supported: {{title}}, {{date}}, {{body}}.`,
    );
  }
  return out;
}

/**
 * Render an HTML document to a PDF file via Playwright's Chromium.
 * @param {string} html
 * @param {string} outPath
 */
export async function renderPdf(html, outPath) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    try {
      ({ chromium } = await import('@playwright/test'));
    } catch {
      throw new Error(
        "renderPdf: Playwright is not available. It is a devDependency; ensure browsers " +
          'are installed with `npx playwright install chromium` (requires network).',
      );
    }
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    throw new Error(
      `renderPdf: could not launch Chromium (${err instanceof Error ? err.message : err}). ` +
        'Run `npx playwright install chromium` (requires network).',
    );
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await mkdir(dirname(outPath), { recursive: true });
    await page.pdf({ path: outPath, format: 'Letter', printBackground: true });
  } finally {
    await browser.close();
  }
}

/**
 * Assemble + render the configuration guide PDF.
 *
 * ⚠ ADOPTER-FACING: this ships to external implementers via the console. It is
 * the configuration guide ONLY — the platform As-Built spec
 * (`haiCore/docs/<date>_as_built.md`) is HAIWAVE-internal and MUST NOT be the
 * body here.
 *
 * @param {{ bodyHtml?: string, bodyHtmlPath?: string, templatePath: string,
 *           outPath: string, title: string, date: string }} opts
 */
export async function buildGuidePdf(opts) {
  const { bodyHtml, bodyHtmlPath, templatePath, outPath, title, date } = opts;
  const body = bodyHtml ?? (await readFile(bodyHtmlPath, 'utf8'));
  const template = await readFile(templatePath, 'utf8');
  const html = injectTemplate(template, { title, date, bodyHtml: body });
  await renderPdf(html, outPath);
  return { outPath, bytes: html.length };
}

// CLI entrypoint: `node scripts/build-guide-pdf.mjs [body.html]`
// Defaults read the generated design-system body staged in private/design-intake/
// and write the PDF into private/agent-downloads/ (baked into the prod image by
// Dockerfile.prod). Adopter-facing → configuration guide ONLY.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const intake = resolve('private/design-intake');
  const bodyHtmlPath = process.argv[2] ?? join(intake, 'body.html');
  const templatePath = resolve('design/configuration-guide/template.html');
  const outPath = resolve('private/agent-downloads/configuration-guide.pdf');
  const date = new Date().toISOString().slice(0, 10);
  buildGuidePdf({ bodyHtmlPath, templatePath, outPath, title: 'Free Agent SCM — Client Implementation Guidelines', date })
    .then((r) => console.log(`Built ${r.outPath}`))
    .catch((err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    });
}
