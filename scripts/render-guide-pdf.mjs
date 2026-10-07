import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guideMarkdownToHtml, parseGuideSource, verifyGuideHtml } from './guide-markdown.mjs';
import { GUIDE_PDF_FILE, GUIDE_RECORD_FILE, parseGuideSourceFile, recordGuidePdf } from './record-guide-pdf.mjs';

/**
 * Render the configuration guide's PDF from its markdown source, and record it.
 *
 *   HAICORE_DIR=<haiCore checkout> npm run render:guide-pdf -- client-implementation-guidelines-v<version>.md
 *
 * One command does the whole step. It reads the guide's markdown from <haiCore>/docs, converts it to the markup the
 * print template styles (guide-markdown.mjs), fills the template (design/configuration-guide/guide-template.html),
 * prints the page to a PDF with Playwright's Chromium, puts the PDF in place as
 * private/agent-downloads/configuration-guide.pdf, and writes its record, configuration-guide.json, beside it
 * (record-guide-pdf.mjs). Run it in the haiWeb directory, in the tree whose private/agent-downloads/ goes into the
 * haiWeb image.
 *
 * The one argument is the source's bare file name. It is required: there is no default, and the command has no flags.
 * HAICORE_DIR (default ../haiCore) is the haiCore checkout that holds the source in docs/.
 *
 * Customers copy commands out of this PDF, so a run is refused and nothing is guessed: when the argument is missing or
 * is not such a name, when the source cannot be read or is not UTF-8 text, when the Version: line of its header comment
 * is not the edition in its file name, when the guide holds anything the template has no markup for (the refusal names
 * the line of the guide), when the template lacks one of its six slots or holds a "{{" that opens none of them, and
 * when the print fails or is not a PDF.
 *
 * The served PDF and its record change together, and only once every check has passed. The page is printed to a file
 * of another name in private/agent-downloads/. A print that is a file, is not empty and begins with %PDF- is renamed
 * over the served PDF, and the record is written right after. A refusal before the rename removes the print and
 * leaves the served PDF and its record byte for byte as they were. A failure after it, in the writing of the record,
 * leaves the new PDF beside the old record: the command says so, and `npm run record:guide-pdf` then makes the record.
 * A run that is killed while it prints can leave its print, configuration-guide.pdf.<random>.rendering, behind. That
 * file is never read again, but it lies in the directory that goes into the image: delete it before the image is built.
 *
 * The print needs Playwright's Chromium (`npx playwright install chromium`). It runs with JavaScript off, and the
 * template is one self-contained file, so the page makes no network request. printGuidePdf is the only part of this
 * file that needs the browser: renderGuidePdf and main take the print step as an argument.
 *
 * Exit 0 = rendered and recorded; 1 = refused, or failed.
 */

/** The print template, from the haiWeb directory. */
export const GUIDE_TEMPLATE_FILE = 'design/configuration-guide/guide-template.html';

/** The language the guide is written in, for the template's lang attribute. */
export const GUIDE_LANG = 'en';

/**
 * How the page is printed. The template sets its own page size and margins in CSS, and paints backgrounds; the PDF is
 * tagged and carries an outline of its headings.
 */
export const GUIDE_PDF_OPTIONS = { preferCSSPageSize: true, printBackground: true, tagged: true, outline: true };

/** The page is printed with JavaScript off: the template has no script, and nothing in the guide's text may run as one. */
export const GUIDE_BROWSER_CONTEXT_OPTIONS = { javaScriptEnabled: false };

/** The five bytes every PDF begins with. A print without them is not a PDF; a print with them is not thereby a good one. */
const PDF_MAGIC = Buffer.from('%PDF-');

/** The three characters that HTML reads as markup, and what is written for each. */
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(/[&<>]/g, (character) => ENTITIES[character]);
}

/** The template's slots, by the name each is written with inside double curly braces. */
const SLOTS = ['lang', 'title', 'cover_line', 'version', 'date', 'body'];

/** How the template's slots are written; every refusal of a template says it. */
const SLOTS_FORM =
  'The template holds each of its six slots at least once, and no other "{{": {{lang}}, {{title}}, {{cover_line}}, {{version}}, {{date}} and {{body}}.';

/**
 * What may not stand in the version or in the date, which the template also writes inside CSS strings: the double
 * quote that ends the string, the backslash that begins an escape, and a line break (a line feed, a carriage return
 * or a form feed), which no CSS string may hold.
 */
const NOT_IN_A_CSS_STRING = /["\\\n\r\f]/;

/**
 * Fill the print template's six slots.
 * @param {string} template
 * @param {{ lang: string, title: string, coverLine: string, version: string, date: string, bodyHtml: string }} fields
 * @returns {string} the page to print
 */
export function fillGuideTemplate(template, { lang, title, coverLine, version, date, bodyHtml }) {
  const missing = SLOTS.filter((name) => !template.includes(`{{${name}}}`));
  if (missing.length > 0) {
    throw new Error(`fillGuideTemplate: the print template lacks ${missing.map((name) => `{{${name}}}`).join(', ')}. ${SLOTS_FORM}`);
  }
  for (let at = template.indexOf('{{'); at !== -1; at = template.indexOf('{{', at + 1)) {
    if (!SLOTS.some((name) => template.startsWith(`{{${name}}}`, at))) {
      const shown = template.slice(at, at + 24).split('\n')[0];
      throw new Error(`fillGuideTemplate: the print template holds ${JSON.stringify(shown)}, a "{{" that does not open one of its slots. ${SLOTS_FORM}`);
    }
  }
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang)) {
    throw new Error(
      `fillGuideTemplate: the language ${JSON.stringify(lang)} is not a language code. ` +
        'Write two lower-case letters, or those, a hyphen and two capitals: en, pt-BR.',
    );
  }
  for (const [name, value] of [['version', version], ['date', date]]) {
    if (NOT_IN_A_CSS_STRING.test(value)) {
      throw new Error(
        `fillGuideTemplate: the ${name} ${JSON.stringify(value)} holds a double quote, a backslash or a line break. ` +
          'The version and the date also stand inside CSS strings in the template, where none of the three may stand.',
      );
    }
  }
  // The five text slots, in one pass over the template: a value that is in is not read again.
  const text = { lang, title: escapeHtml(title), cover_line: escapeHtml(coverLine), version, date };
  const filled = template.replace(/\{\{(lang|title|cover_line|version|date)\}\}/g, (_slot, name) => text[name]);
  // Now every "{{" is one of the body's slots, as many as the template has. One more came out of a value.
  if (filled.split('{{').length !== template.split('{{body}}').length) {
    throw new Error(
      'fillGuideTemplate: the title, the cover line, the version or the date holds "{{", which is how the template writes its slots. ' +
        'It would be taken for a slot: write the text without "{{".',
    );
  }
  return filled.split('{{body}}').join(bodyHtml);
}

/**
 * Print the page to a PDF file with Playwright's Chromium. This is the print step of a real run, and the one part of
 * this file that needs a browser: no test runs it.
 * @param {string} html the filled template
 * @param {string} outPath where the PDF is written
 */
export async function printGuidePdf(html, outPath) {
  let chromium;
  try {
    ({ chromium } = await import('playwright').catch(() => import('@playwright/test')));
  } catch {
    throw new Error('printGuidePdf: Playwright is not installed. Run `npm install` in the haiWeb directory, then `npx playwright install chromium`.');
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    throw new Error(
      `printGuidePdf: Chromium did not start (${err instanceof Error ? err.message : String(err)}). Run \`npx playwright install chromium\`.`,
    );
  }
  try {
    const context = await browser.newContext(GUIDE_BROWSER_CONTEXT_OPTIONS);
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: outPath, ...GUIDE_PDF_OPTIONS });
  } finally {
    await browser.close();
  }
}

/**
 * Render the guide: read its markdown, convert it, fill the print template, print the page and record the PDF.
 * @param {{ haiwebDir: string, haicoreDir: string, sourceFile: string, now?: Date,
 *           print?: (html: string, outPath: string) => Promise<void> }} opts
 * @returns {Promise<{ record: { bodySha256: string, edition: string, sourceFile: string, sourceSha256: string, builtAt: string }, pdfBytes: number }>}
 */
export async function renderGuidePdf({ haiwebDir, haicoreDir, sourceFile, now, print = printGuidePdf }) {
  const { edition } = parseGuideSourceFile(sourceFile);
  const haicoreDocsDir = join(haicoreDir, 'docs');
  const sourcePath = join(haicoreDocsDir, sourceFile);
  let sourceBytes;
  try {
    sourceBytes = readFileSync(sourcePath);
  } catch {
    throw new Error(`renderGuidePdf: cannot read the guide source ${sourcePath}. Set HAICORE_DIR to the haiCore checkout that holds it.`);
  }
  // The bytes are read as UTF-8 and nothing else. A lenient reader puts U+FFFD in place of every byte that is not
  // UTF-8, and the print would then show that character where the guide's author wrote another. A byte order mark
  // is kept as the character it is: the record's hash of the text counts it too, and line 1 is refused for it.
  let markdown;
  try {
    markdown = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(sourceBytes);
  } catch {
    throw new Error(
      `renderGuidePdf: the guide source ${sourcePath} is not valid UTF-8. It holds bytes that are no character in UTF-8, ` +
        'and no character is guessed in their place: save the file as UTF-8.',
    );
  }
  const { slots, body, bodyFirstLine } = parseGuideSource(markdown);
  if (slots.version !== edition) {
    throw new Error(
      `renderGuidePdf: ${sourceFile} says "Version: ${slots.version}" in its header comment, and its file name says ${edition}. ` +
        'The two must be the same.',
    );
  }
  const bodyHtml = guideMarkdownToHtml(body, { firstLine: bodyFirstLine });
  verifyGuideHtml(body, bodyHtml);
  const templatePath = join(haiwebDir, GUIDE_TEMPLATE_FILE);
  let template;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch {
    throw new Error(`renderGuidePdf: cannot read the print template ${templatePath}. Run the command in the haiWeb directory.`);
  }
  const html = fillGuideTemplate(template, {
    lang: GUIDE_LANG,
    title: slots.title,
    coverLine: slots.coverLine,
    version: slots.version,
    date: slots.date,
    bodyHtml,
  });
  const downloadsDir = join(haiwebDir, 'private', 'agent-downloads');
  // Printed under a name of this run's own, so that no file an earlier run left behind is ever taken for this print.
  const printedPath = join(downloadsDir, `${GUIDE_PDF_FILE}.${randomBytes(8).toString('hex')}.rendering`);
  try {
    await print(html, printedPath);
    if (!existsSync(printedPath)) throw new Error('renderGuidePdf: the print step wrote no file.');
    const printed = readFileSync(printedPath);
    if (printed.length === 0) throw new Error('renderGuidePdf: the print step wrote an empty file.');
    if (!printed.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new Error('renderGuidePdf: the print step wrote a file that does not begin with %PDF-, so it is not a PDF.');
    }
    renameSync(printedPath, join(downloadsDir, GUIDE_PDF_FILE));
  } catch (err) {
    // Refused before the new PDF is in place: the print goes, and the served PDF and its record stay as they were.
    rmSync(printedPath, { force: true });
    throw err;
  }
  // The new PDF is in place. A failure from here on cannot leave things as they were, and it says so.
  try {
    return recordGuidePdf({ downloadsDir, haicoreDocsDir, sourceFile, now });
  } catch (err) {
    throw Object.assign(err, { pdfReplaced: true });
  }
}

const USAGE = 'Usage: HAICORE_DIR=<haiCore checkout> npm run render:guide-pdf -- client-implementation-guidelines-v<version>.md';

/**
 * The command: `args` holds the guide source's bare file name. A refusal is one `warn` call with the reason, and
 * never a thrown error.
 * @param {{ args: string[], haiwebDir: string, haicoreDir: string, now?: Date,
 *           print?: (html: string, outPath: string) => Promise<void>,
 *           log?: (message: string) => void, warn?: (message: string) => void }} opts
 * @returns {Promise<number>} the exit code: 0 = rendered and recorded, 1 = refused
 */
export async function main({ args, haiwebDir, haicoreDir, now, print, log = console.log, warn = console.error }) {
  try {
    if (args.length !== 1) {
      throw new Error(`render:guide-pdf takes exactly one argument, the guide source's bare file name, and ${args.length} came.`);
    }
    const { record, pdfBytes } = await renderGuidePdf({ haiwebDir, haicoreDir, sourceFile: args[0], now, print });
    log(
      `Rendered ${GUIDE_PDF_FILE} (${pdfBytes} bytes, sha256 ${record.bodySha256}) from ${record.sourceFile}, ` +
        `edition ${record.edition} → recorded in ${GUIDE_RECORD_FILE}`,
    );
    return 0;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const outcome =
      err instanceof Error && 'pdfReplaced' in err
        ? 'The served PDF was replaced and its record was not made. Make the record again: npm run record:guide-pdf -- <guide source file>'
        : 'Refused: the served PDF and its record were not changed.';
    warn(`${reason}\n${outcome}\n${USAGE}`);
    return 1;
  }
}

/**
 * True when this file is the process's entry point, false when it is imported (the tests import its functions).
 * Real paths on both sides. A file URL encodes a space, `#`, `%` and every non-ASCII character, and through a symlink
 * argv[1] is the link while import.meta.url is the file it points to: compared as text the two can differ, and the
 * command would then print nothing, write nothing and exit 0. An argv[1] that is absent or names no file has no real
 * path (realpathSync throws): it is not this file, and importing the module must not throw.
 */
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main({
    args: process.argv.slice(2),
    haiwebDir: resolve('.'),
    haicoreDir: resolve(process.env.HAICORE_DIR ?? '../haiCore'),
  }).then((code) => process.exit(code));
}
