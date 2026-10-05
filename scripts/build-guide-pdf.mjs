import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
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
 * (`haiCore/docs/client-implementation-guidelines-v1.6.md`) — so this build step does
 * NO markdown conversion. It checks the body's source binding (the first page
 * section names the edition, the source file and that file's SHA-256, and the file
 * under HAICORE_DIR must still hash to it), assembles + renders, and then writes
 * `configuration-guide.json` beside the PDF.
 *
 * `renderPdf` needs Playwright + an installed Chromium; it fails with an actionable
 * message when absent, so the build degrades loudly (never silently produces an
 * empty/stale PDF). The other steps need no browser and are unit-tested:
 * `injectTemplate` (including against the real committed template), the source
 * binding check and the write of `configuration-guide.json`.
 */

const PLACEHOLDERS = { title: 'title', date: 'date', bodyHtml: 'body' };

/** Written beside the PDF; the haiWeb BFF and publish:help-pack read it (plan C.6). */
export const GUIDE_MANIFEST_FILE = 'configuration-guide.json';
const SOURCE_FILE_RE = /^client-implementation-guidelines-v([\d.]+)\.md$/;

/** @param {string} text */
export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The source binding (README § Source binding): the first `<section class="page">` in body.html names the guide edition,
 * the markdown file it was authored from, and that file's SHA-256 at authoring time.
 * @param {string} bodyHtml
 * @returns {{ edition: string, sourceFile: string, sourceSha256: string }}
 */
export function extractSourceBinding(bodyHtml) {
  // CN-1: comments are not markup. A quoted or commented-out <section class="page"> must never be read as the first page.
  const first = bodyHtml.replace(/<!--[\s\S]*?-->/g, '').match(/<section\b[^>]*\bclass="page"[^>]*>/);
  if (!first) throw new Error('extractSourceBinding: body.html has no <section class="page"> to carry the source binding');
  const attr = (name) => first[0].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '';
  const edition = attr('data-edition');
  const sourceFile = attr('data-source');
  const sourceSha256 = attr('data-source-sha256');
  for (const [name, value] of [['data-edition', edition], ['data-source', sourceFile], ['data-source-sha256', sourceSha256]]) {
    if (!value) {
      throw new Error(`extractSourceBinding: the first <section class="page"> in body.html must carry ${name} (design/configuration-guide/README.md § Source binding)`);
    }
  }
  const m = SOURCE_FILE_RE.exec(sourceFile);
  if (!m) throw new Error(`extractSourceBinding: data-source "${sourceFile}" is not a client-implementation-guidelines-v<edition>.md file`);
  if (m[1] !== edition) throw new Error(`extractSourceBinding: data-edition "${edition}" does not match the edition in data-source "${sourceFile}"`);
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) throw new Error('extractSourceBinding: data-source-sha256 must be 64 lowercase hex characters');
  return { edition, sourceFile, sourceSha256 };
}

/**
 * Refuse a render whose source markdown changed after the body was authored (spec §5.4 Q2 ruling).
 * @param {{ sourceFile: string, sourceSha256: string }} binding
 * @param {string} haicoreDocsDir
 */
export async function verifySourceUnchanged(binding, haicoreDocsDir) {
  const path = join(haicoreDocsDir, binding.sourceFile);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new Error(`verifySourceUnchanged: cannot read the guide source ${path} (set HAICORE_DIR to the haiCore checkout)`);
  }
  const actual = sha256Hex(text);
  if (actual !== binding.sourceSha256) {
    throw new Error(
      `verifySourceUnchanged: ${binding.sourceFile} changed since body.html was authored ` +
        `(sha256 ${actual} ≠ data-source-sha256 ${binding.sourceSha256}). Re-run the authoring pass for this edition, then rebuild.`,
    );
  }
}

/**
 * @param {string} outDir
 * @param {{ bodySha256: string, edition: string, sourceFile: string, sourceSha256: string, builtAt: string }} manifest
 */
export async function writeGuideManifest(outDir, manifest) {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, GUIDE_MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');
}

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
 * Assemble + render the configuration guide PDF, then record what it was built from.
 *
 * ⚠ ADOPTER-FACING: this ships to external implementers via the console. It is
 * the configuration guide ONLY — the platform As-Built spec
 * (`haiCore/docs/<date>_as_built.md`) is HAIWAVE-internal and MUST NOT be the
 * body here.
 *
 * @param {{ bodyHtml?: string, bodyHtmlPath?: string, templatePath: string, outPath: string, title: string,
 *           date: string, haicoreDocsDir: string, now?: Date, render?: (html: string, outPath: string) => Promise<void> }} opts
 */
export async function buildGuidePdf(opts) {
  const { bodyHtml, bodyHtmlPath, templatePath, outPath, title, date, haicoreDocsDir, now = new Date(), render = renderPdf } = opts;
  const body = bodyHtml ?? (await readFile(bodyHtmlPath, 'utf8'));
  const binding = extractSourceBinding(body);
  await verifySourceUnchanged(binding, haicoreDocsDir);
  const template = await readFile(templatePath, 'utf8');
  const html = injectTemplate(template, { title, date, bodyHtml: body });
  await render(html, outPath);
  const manifest = { bodySha256: sha256Hex(body), ...binding, builtAt: now.toISOString() };
  await writeGuideManifest(dirname(outPath), manifest);
  return { outPath, bytes: html.length, manifest };
}

// CLI entrypoint: `node scripts/build-guide-pdf.mjs [body.html]`
// Defaults read the committed generated body (design/configuration-guide/body.html)
// and write the PDF into private/agent-downloads/ (baked into the prod image by
// Dockerfile.prod). Adopter-facing → configuration guide ONLY.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const bodyHtmlPath = process.argv[2] ?? resolve('design/configuration-guide/body.html');
  const templatePath = resolve('design/configuration-guide/template.html');
  const outPath = resolve('private/agent-downloads/configuration-guide.pdf');
  const date = new Date().toISOString().slice(0, 10);
  const haicoreDocsDir = resolve(process.env.HAICORE_DIR ?? '../haiCore', 'docs');
  buildGuidePdf({ bodyHtmlPath, templatePath, outPath, title: 'Free Agent SCM — Client Implementation Guidelines', date, haicoreDocsDir })
    .then((r) => console.log(`Built ${r.outPath} (edition ${r.manifest.edition}, source ${r.manifest.sourceFile}) + ${GUIDE_MANIFEST_FILE}`))
    .catch((err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    });
}
