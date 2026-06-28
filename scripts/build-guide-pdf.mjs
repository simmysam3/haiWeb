import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Generate `configuration-guide.pdf` from the source markdown through a committed
 * Claude Design template, so the published guide no longer drifts from the source
 * on a manual export.
 *
 * Pipeline:  markdown (guide + dated as-built)  →  HTML (marked)
 *            →  inject into design template  →  PDF (Playwright/Chromium).
 *
 * The only piece with no external dependency is `injectTemplate`, which is the
 * contract with the template (and is unit-tested). `markdownToHtml` needs the
 * `marked` package; `renderPdf` needs Playwright + an installed Chromium. Both
 * fail with an actionable message when their dependency is absent, so this script
 * degrades loudly (never silently produces an empty/stale PDF).
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
 * Render markdown to an HTML fragment. Uses `marked` (a devDependency); if it is
 * not installed, throw with the install command rather than a cryptic import error.
 * @param {string} md
 * @returns {Promise<string>}
 */
export async function markdownToHtml(md) {
  let marked;
  try {
    ({ marked } = await import('marked'));
  } catch {
    throw new Error(
      "markdownToHtml: the 'marked' package is not installed. Run `npm i -D marked` " +
        '(requires network) to enable PDF generation.',
    );
  }
  return marked.parse(md, { async: false });
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
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}

/**
 * Full build: read the dated guide + as-built markdown, render through the
 * template, write the PDF into the agent-downloads dir the console serves.
 *
 * @param {{ guideMdPath: string, asBuiltMdPath?: string, templatePath: string,
 *           outPath: string, title: string, date: string }} opts
 */
export async function buildGuidePdf(opts) {
  const { guideMdPath, asBuiltMdPath, templatePath, outPath, title, date } = opts;
  const guideMd = await readFile(guideMdPath, 'utf8');
  const asBuiltMd = asBuiltMdPath ? await readFile(asBuiltMdPath, 'utf8') : '';
  const combinedMd = asBuiltMd
    ? `${guideMd}\n\n<div class="page-break"></div>\n\n# As-Built (${date})\n\n${asBuiltMd}`
    : guideMd;
  const bodyHtml = await markdownToHtml(combinedMd);
  const template = await readFile(templatePath, 'utf8');
  const html = injectTemplate(template, { title, date, bodyHtml });
  await renderPdf(html, outPath);
  return { outPath, bytes: html.length };
}

// CLI entrypoint: `node scripts/build-guide-pdf.mjs <guide.md> [as-built.md]`
// Defaults read the dated sources staged in private/design-intake/ and write the
// PDF into private/agent-downloads/ (baked into the prod image by Dockerfile.prod).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const intake = resolve('private/design-intake');
  const guideMdPath = process.argv[2] ?? join(intake, 'configuration-guide.md');
  const asBuiltMdPath = process.argv[3] ?? join(intake, 'as-built.md');
  const templatePath = resolve('design/configuration-guide/template.html');
  const outPath = resolve('private/agent-downloads/configuration-guide.pdf');
  const date = new Date().toISOString().slice(0, 10);
  buildGuidePdf({ guideMdPath, asBuiltMdPath, templatePath, outPath, title: 'HAIWAVE Free Agent — Configuration Guide', date })
    .then((r) => console.log(`Built ${r.outPath}`))
    .catch((err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    });
}
