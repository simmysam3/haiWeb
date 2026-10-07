// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, realpathSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  GUIDE_TEMPLATE_FILE, GUIDE_LANG, GUIDE_PDF_OPTIONS, GUIDE_BROWSER_CONTEXT_OPTIONS, fillGuideTemplate, printGuidePdf, renderGuidePdf, main,
} from '../render-guide-pdf.mjs';
import { sha256OfFile } from '../record-guide-pdf.mjs';

const created: string[] = [];
const tmp = (prefix: string) => { const dir = mkdtempSync(join(tmpdir(), prefix)); created.push(dir); return dir; };
afterEach(() => { created.forEach((dir) => rmSync(dir, { recursive: true, force: true })); created.length = 0; });

describe('the template file and the language', () => {
  it('are design/configuration-guide/guide-template.html and en', () => {
    expect([GUIDE_TEMPLATE_FILE, GUIDE_LANG]).toEqual(['design/configuration-guide/guide-template.html', 'en']);
  });
});

/** A template that is nothing but its slots, each of the six standing twice. */
const EVERY_SLOT_TWICE = [
  '{{lang}}|{{title}}|{{cover_line}}|{{version}}|{{date}}|{{body}}',
  '{{lang}}|{{title}}|{{cover_line}}|{{version}}|{{date}}|{{body}}',
].join('\n');
/** The same with each slot once. */
const EVERY_SLOT_ONCE = '{{lang}}|{{title}}|{{cover_line}}|{{version}}|{{date}}|{{body}}';
/** What fills a template where a test does not say otherwise. */
const FIELDS = {
  lang: 'en',
  title: 'Free Agent SCM: Sample Administration Notesheets',
  coverLine: 'Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL',
  version: '1.104.0',
  date: '2026-10-06',
  bodyHtml: '<h2>Contents</h2>\n<p>Enter here.</p>\n',
};

describe('fillGuideTemplate', () => {
  it('fills every slot at every place it stands', () => {
    const line =
      'en|Free Agent SCM: Sample Administration Notesheets|Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL' +
      '|1.104.0|2026-10-06|<h2>Contents</h2>\n<p>Enter here.</p>\n';
    expect(fillGuideTemplate(EVERY_SLOT_TWICE, FIELDS)).toBe(`${line}\n${line}`);
  });

  // The title and the cover line are text of the guide. The version and the date also stand inside a CSS string, where
  // an entity would be printed letter for letter.
  it('writes the title and the cover line with &, < and > as entities, and the version, the date and the language as given', () => {
    const filled = fillGuideTemplate(EVERY_SLOT_ONCE, {
      ...FIELDS,
      lang: 'pt-BR',
      title: 'Install & run <the agent>',
      coverLine: 'R&D > "ops" <1.104>',
      version: '1.104.0 & <beta>',
      date: "2026-10-06 > 'draft'",
    });
    expect(filled).toBe(`pt-BR|Install &amp; run &lt;the agent&gt;|R&amp;D &gt; "ops" &lt;1.104&gt;|1.104.0 & <beta>|2026-10-06 > 'draft'|${FIELDS.bodyHtml}`);
  });

  // A replacement string reads "$&" as the text that was matched, "$$" as one "$", "$`" and "$'" as the text before and
  // after. The values are text, and none of them is a replacement string.
  it('writes a title, a cover line, a version and a date that hold $&, $1, $$, $` and $\' exactly as they are', () => {
    const marks = "$1 and $$ and $` and $' and $&";
    const filled = fillGuideTemplate(EVERY_SLOT_ONCE, { ...FIELDS, title: `T ${marks}`, coverLine: `C ${marks}`, version: `V ${marks}`, date: `D ${marks}` });
    expect(filled).toBe(`en|T ${marks}amp;|C ${marks}amp;|V ${marks}|D ${marks}|${FIELDS.bodyHtml}`);
  });

  // What the body holds is the guide's own text: no slot in it is filled, and it is no replacement string either.
  it('puts the body in last and as it is: {{title}}, {{x}}, {{body}}, $&, $1 and $$ in the body come out unchanged', () => {
    const bodyHtml = '<p>Write {{title}}, {{x}} and {{body}}; pay $& or $1 or $$.</p>\n';
    expect(fillGuideTemplate(EVERY_SLOT_TWICE, { ...FIELDS, bodyHtml })).toBe(
      [`en|${FIELDS.title}|${FIELDS.coverLine}|1.104.0|2026-10-06|${bodyHtml}`, `en|${FIELDS.title}|${FIELDS.coverLine}|1.104.0|2026-10-06|${bodyHtml}`].join('\n'),
    );
  });

  /** The template of every slot twice, with one slot cut out at both of its places. */
  const without = (slot: string) => EVERY_SLOT_TWICE.split(`{{${slot}}}`).join('');

  it.each([
    ['lang'],
    ['title'],
    ['cover_line'],
    ['version'],
    ['date'],
    ['body'],
  ])('refuses a template that has no {{%s}} slot, and names the slot', (slot) => {
    expect(without(slot)).not.toContain(`{{${slot}}}`);
    expect(() => fillGuideTemplate(without(slot), FIELDS)).toThrow(`the print template lacks {{${slot}}}.`);
  });

  // The real template names its slots in a comment, and has a <title> element: a name alone is not a slot.
  it('refuses a template that holds the name of a slot as text, and not the slot', () => {
    const run = () => fillGuideTemplate('<!-- slots: lang, title, cover_line, version, date, body -->\n{{lang}}|<title>title</title>|{{cover_line}}|{{version}}|{{date}}|{{body}}', FIELDS);
    expect(run).toThrow('the print template lacks {{title}}.');
  });

  it('names every slot that a template lacks, in the order of the six', () => {
    const run = () => fillGuideTemplate('{{title}}|{{version}}|{{body}}', FIELDS);
    expect(run).toThrow('the print template lacks {{lang}}, {{cover_line}}, {{date}}.');
  });

  // Each stands on a line of its own after the six slots, so the template lacks nothing.
  it.each([
    ['a slot with another name', '{{other}}'],
    ['two opening braces that nothing closes', '{{'],
    ['a slot name with spaces inside the braces', '{{ title }}'],
    ['a slot name with a capital letter', '{{Title}}'],
    ['three opening braces before a slot name', '{{{title}}'],
    ['a slot that closes with one brace', '{{body}'],
  ])('refuses a template that holds %s, and shows it', (_label, extra) => {
    const run = () => fillGuideTemplate(`${EVERY_SLOT_ONCE}\n${extra}`, FIELDS);
    expect(run).toThrow(`the print template holds ${JSON.stringify(extra)}, a "{{" that does not open one of its slots.`);
  });

  it('shows the first 24 characters of what is not a slot when it runs on for longer', () => {
    const run = () => fillGuideTemplate(`${EVERY_SLOT_ONCE}\n{{a_name_that_runs_on_and_on_for_long}}`, FIELDS);
    expect(run).toThrow('the print template holds "{{a_name_that_runs_on_an", a "{{" that does not open one of its slots.');
  });

  it('shows what is not a slot up to the end of its line', () => {
    const run = () => fillGuideTemplate(`${EVERY_SLOT_ONCE}\n{{ab\ncd}}`, FIELDS);
    expect(run).toThrow('the print template holds "{{ab", a "{{" that does not open one of its slots.');
  });

  // The title, the cover line, the version and the date are text. A "{{" in one of them would be filled in as a slot,
  // or would leave the page with one.
  it.each<[string, Partial<typeof FIELDS>]>([
    ['a title that holds a slot of another name', { title: 'How to write {{x}}' }],
    ['a title that holds the name of the date\'s slot', { title: 'The {{date}} edition' }],
    ['a title that holds the name of the body\'s slot', { title: 'The {{body}} of the guide' }],
    ['a cover line that holds the name of the title\'s slot', { coverLine: 'The cover of {{title}}' }],
    ['a version that holds the name of the body\'s slot', { version: '1.104.0 {{body}}' }],
    ['a date that holds two opening braces and no more', { date: '2026-10-06 {{' }],
  ])('refuses %s: no value is taken for a slot', (_label, fields) => {
    const run = () => fillGuideTemplate(EVERY_SLOT_TWICE, { ...FIELDS, ...fields });
    expect(run).toThrow('fillGuideTemplate: the title, the cover line, the version or the date holds "{{", which is how the template writes its slots.');
  });

  // The version and the date also stand inside CSS strings: a double quote would end the string, a backslash begins an
  // escape, and a string may not run over a line break.
  it.each<[string, 'version' | 'date', string]>([
    ['a version that holds a double quote', 'version', '1.104.0"'],
    ['a version that holds a backslash', 'version', '1.104\\.0'],
    ['a version that holds a line feed', 'version', '1.104.0\n'],
    ['a version that holds a carriage return', 'version', '1.104\r.0'],
    ['a version that holds a form feed', 'version', '\f1.104.0'],
    ['a date that holds a double quote', 'date', '2026-10-06"'],
    ['a date that holds a backslash', 'date', '2026\\10\\06'],
    ['a date that holds a line feed', 'date', '2026-10-06\n'],
    ['a date that holds a carriage return', 'date', '2026-10\r-06'],
    ['a date that holds a form feed', 'date', '\f2026-10-06'],
  ])('refuses %s, and shows the value', (_label, slot, value) => {
    const run = () => fillGuideTemplate(EVERY_SLOT_ONCE, { ...FIELDS, [slot]: value });
    expect(run).toThrow(`fillGuideTemplate: the ${slot} ${JSON.stringify(value)} holds a double quote, a backslash or a line break.`);
  });

  // The language goes into the lang attribute of the page as it is given.
  it.each([
    ['in capitals', 'EN'],
    ['as a word', 'english'],
    ['as one letter', 'e'],
    ['with its region in lower case', 'en-us'],
    ['with a region of three letters', 'en-USA'],
    ['with an underscore before its region', 'en_US'],
    ['as nothing at all', ''],
    ['with a line break after it', 'en\n'],
    ['with a space before it', ' en'],
    ['with markup after it', 'en"><p>'],
  ])('refuses a language written %s, and shows the value', (_label, lang) => {
    const run = () => fillGuideTemplate(EVERY_SLOT_ONCE, { ...FIELDS, lang });
    expect(run).toThrow(`fillGuideTemplate: the language ${JSON.stringify(lang)} is not a language code.`);
  });
});

describe('the print template in design/configuration-guide', () => {
  /** The committed template, read from the checkout this test file is in. */
  const committed = () => readFileSync(fileURLToPath(new URL(`../../${GUIDE_TEMPLATE_FILE}`, import.meta.url)), 'utf8');

  it('holds the six slots, each at least once, and no other "{{"', () => {
    const slots = committed().match(/\{\{[a-z_]+\}\}/g) ?? [];
    expect([...new Set(slots)].sort()).toEqual(['{{body}}', '{{cover_line}}', '{{date}}', '{{lang}}', '{{title}}', '{{version}}']);
    expect(committed().split('{{')).toHaveLength(slots.length + 1);
  });

  // The page is printed with no network and no script: everything it shows is in the file.
  it.each(['<script', '<link', '@import', 'http://', 'https://'])('holds no %s, in any case of letters', (mark) => {
    expect(committed().toLowerCase()).not.toContain(mark);
  });

  it('is filled by fillGuideTemplate with no refusal: the six values are in, and no "{{" is left', () => {
    const html = fillGuideTemplate(committed(), FIELDS);
    expect(html).not.toContain('{{');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(`<title>${FIELDS.title}</title>`);
    expect(html).toContain(`<h1 class="cover-title">${FIELDS.title}</h1>`);
    expect(html).toContain(`<p class="cover-line">${FIELDS.coverLine}</p>`);
    expect(html).toContain('<span class="cover-version">1.104.0</span><span class="cover-date">2026-10-06</span>');
    expect(html).toContain(`<main>\n${FIELDS.bodyHtml}\n</main>`);
    // The running footer of every page: the version and the date inside a CSS string.
    expect(html).toMatch(/content:"1\.104\.0[^"]*2026-10-06";/);
  });

  // The cover's wave is an accent, barely visible. Its image reaches an alpha of 92 of 255, so it is drawn at half strength.
  it('draws the cover wave at half strength', () => {
    const rule = committed().match(/\.cover-wave\{[^}]*\}/)?.[0];
    expect(rule).toBeDefined();
    expect(rule?.match(/;opacity:([^;}]*)[;}]/)?.[1]).toBe('.5');
  });
});

const SOURCE_FILE = 'client-implementation-guidelines-v1.104.0.md';
/**
 * A small guide in the real file's form: the header comment with its Version: and Dated: lines and its note for the
 * designer, the three lines of the cover, then the body. The numbers beside the lines are their line numbers in the file.
 */
const GUIDE_LINES = [
  '<!--', // 1
  '  SOURCE OF RECORD: Free Agent SCM: Install & Configure', // 2
  '  Version: 1.104.0', // 3
  '  Dated:    2026-10-06', // 4
  '', // 5
  '  For the designer: title "Free Agent SCM: Install & Configure"; cover line', // 6
  '  "Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL"; logo = docs/haiwave-logo.png.', // 7
  '-->', // 8
  '', // 9
  '![HAIWAVE](haiwave-logo.png)', // 10
  '', // 11
  '# Free Agent SCM: Install & Configure', // 12
  '', // 13
  '**Sample Administration Notes · Version 1.104.0** (platform level v1.104) · CONFIDENTIAL', // 14
  '', // 15
  'This sheet is the technical statement.', // 16
  '', // 17
  '## §1 First Steps', // 18
  '', // 19
  'Run the agent with `agent.env`.', // 20
  '', // the file ends with a line break
];
const GUIDE = GUIDE_LINES.join('\n');
/** A small print template with the six slots where the real one has them: the title, the version and the date twice, the last two also in a CSS string. */
const TEMPLATE = [
  '<!DOCTYPE html>',
  '<html lang="{{lang}}">',
  '<head><title>{{title}}</title>',
  '<style>@page { @bottom-left { content: "{{version}} / {{date}}"; } }</style></head>',
  '<body>',
  '<header><h1>{{title}}</h1><p>{{cover_line}}</p><span>{{version}}</span><span>{{date}}</span></header>',
  '<main>',
  '{{body}}',
  '</main>',
  '</body>',
  '</html>',
  '',
].join('\n');
/** The page that the small guide makes of the small template. */
const PAGE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head><title>Free Agent SCM: Install &amp; Configure</title>',
  '<style>@page { @bottom-left { content: "1.104.0 / 2026-10-06"; } }</style></head>',
  '<body>',
  '<header><h1>Free Agent SCM: Install &amp; Configure</h1><p>Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL</p><span>1.104.0</span><span>2026-10-06</span></header>',
  '<main>',
  '<p>This sheet is the technical statement.</p>',
  '<h2>§1 First Steps</h2>',
  '<p>Run the agent with <code>agent.env</code>.</p>',
  '',
  '</main>',
  '</body>',
  '</html>',
  '',
].join('\n');
/** A stand-in for a printed PDF: it begins with %PDF- and holds bytes that are not valid UTF-8. */
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0xff, 0xfe, 0x00]), Buffer.from('\n%%EOF\n')]);
/** The PDF and the record of the edition before, which the downloads directory holds when a tree is made with `served`. */
const OLD_PDF = Buffer.from('%PDF-1.4\nthe PDF of the edition before\n%%EOF\n');
const OLD_RECORD = Buffer.from('{ "bodySha256": "the record of the PDF of the edition before" }\n');
const NOW = new Date('2026-10-07T11:00:00.000Z');
const bytesSha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const textSha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * A haiWeb tree with the small template and its downloads directory, and a haiCore tree with the small guide, side by
 * side in one temp directory. With `served`, the downloads directory holds the PDF and the record of the edition before.
 */
function tree({ served = false }: { served?: boolean } = {}) {
  const root = tmp('render-guide-');
  const web = join(root, 'web');
  const core = join(root, 'core');
  const downloads = join(web, 'private', 'agent-downloads');
  const docs = join(core, 'docs');
  const templatePath = join(web, GUIDE_TEMPLATE_FILE);
  const sourcePath = join(docs, SOURCE_FILE);
  const pdfPath = join(downloads, 'configuration-guide.pdf');
  const recordPath = join(downloads, 'configuration-guide.json');
  for (const dir of [downloads, docs, dirname(templatePath)]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(downloads, '.gitkeep'), '');
  writeFileSync(templatePath, TEMPLATE);
  writeFileSync(sourcePath, GUIDE);
  if (served) {
    writeFileSync(pdfPath, OLD_PDF);
    writeFileSync(recordPath, OLD_RECORD);
  }
  return { web, core, downloads, docs, templatePath, sourcePath, pdfPath, recordPath };
}

/**
 * A print step for the tests: it keeps what it is called with, and writes `bytes` to the path it is handed, as the real
 * one writes the PDF (no file when `bytes` is null). With `failure`, it then fails with that error.
 */
function printer(bytes: Buffer | null = PDF, failure?: Error) {
  const calls: { html: string; outPath: string }[] = [];
  const print = async (html: string, outPath: string) => {
    calls.push({ html, outPath });
    if (bytes !== null) writeFileSync(outPath, bytes);
    if (failure) throw failure;
  };
  return { calls, print };
}

/** What a run of renderGuidePdf over a tree is called with. */
const runOptions = (t: Tree, print: ReturnType<typeof printer>['print']) => ({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print });

type Tree = ReturnType<typeof tree>;
/** The files of a directory, each with its bytes. */
const filesOf = (dir: string) => Object.fromEntries(readdirSync(dir).sort().map((name) => [name, readFileSync(join(dir, name)).toString('hex')]));

describe('renderGuidePdf', () => {
  it('hands the print step the template filled from the guide: the language, the four values of the cover and the converted body', async () => {
    const t = tree();
    const p = printer();
    await renderGuidePdf({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print: p.print });
    expect(p.calls.map((call) => call.html)).toEqual([PAGE]);
  });

  // Each case is run twice: in a downloads directory that holds no guide yet, and in one that serves the edition before.
  it('prints to a file of another name in private/agent-downloads, and then puts that file in place as configuration-guide.pdf', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const p = printer();
      await renderGuidePdf({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print: p.print });
      expect(p.calls).toHaveLength(1);
      const { outPath } = p.calls[0];
      expect(dirname(outPath)).toBe(t.downloads);
      expect(basename(outPath)).not.toBe('configuration-guide.pdf');
      expect(readFileSync(t.pdfPath)).toEqual(PDF);
      expect(existsSync(outPath)).toBe(false);
    }
  });

  // A run that is killed leaves its print behind. A later run must not find that file under the name it prints to,
  // or a print step that wrote nothing would pass the old file on as the new PDF.
  it('prints each run to a name of its own', async () => {
    const t = tree();
    const outPaths: string[] = [];
    for (let run = 0; run < 3; run += 1) {
      const p = printer();
      await renderGuidePdf({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print: p.print });
      outPaths.push(p.calls[0].outPath);
    }
    expect(new Set(outPaths).size).toBe(3);
  });

  it('then records the PDF and returns the record: the hash of the printed bytes, the edition, the source file and the hash of its text, and the time of the run', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const result = await renderGuidePdf({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print: printer().print });
      const record = { bodySha256: bytesSha(PDF), edition: '1.104.0', sourceFile: SOURCE_FILE, sourceSha256: textSha(GUIDE), builtAt: '2026-10-07T11:00:00.000Z' };
      expect(readFileSync(t.recordPath, 'utf8')).toBe(JSON.stringify(record, null, 2) + '\n');
      expect(result).toEqual({ record, pdfBytes: PDF.length });
      expect(readFileSync(t.pdfPath)).toEqual(PDF);
      expect(readdirSync(t.downloads).sort()).toEqual(['.gitkeep', 'configuration-guide.json', 'configuration-guide.pdf']);
    }
  });

  // Each refusal is tried twice, in a fresh tree each time: in a downloads directory that holds no guide yet, and in one
  // that serves the edition before. Afterwards the directory holds the same files with the same bytes: neither the PDF
  // nor the record was made or changed, and no print was left behind. `prints` says whether the print step was reached.
  it.each<[string, (t: Tree) => void, () => ReturnType<typeof printer>, (t: Tree) => string[], number]>([
    ['the guide source cannot be read', (t) => rmSync(t.sourcePath), () => printer(), (t) => [`renderGuidePdf: cannot read the guide source ${t.sourcePath}.`, 'HAICORE_DIR'], 0],
    [
      'the guide source holds a byte that is not UTF-8, here 0xE9 (an é saved as Latin-1) inside a code span',
      (t) => {
        const [before, after] = GUIDE.split('agent.env');
        writeFileSync(t.sourcePath, Buffer.concat([Buffer.from(`${before}caf`), Buffer.from([0xe9]), Buffer.from(`.env${after}`)]));
      },
      () => printer(),
      (t) => [
        `renderGuidePdf: the guide source ${t.sourcePath} is not valid UTF-8. It holds bytes that are no character in UTF-8, ` +
          'and no character is guessed in their place: save the file as UTF-8.',
      ],
      0,
    ],
    [
      // The file's last two bytes are the first two of the three bytes of a euro sign, as in a file that was cut short.
      // A reader that decodes in pieces holds such bytes back for a next piece, and here no next piece comes.
      'the guide source ends in the middle of a character',
      (t) => writeFileSync(t.sourcePath, Buffer.concat([Buffer.from(GUIDE), Buffer.from([0xe2, 0x82])])),
      () => printer(),
      (t) => [
        `renderGuidePdf: the guide source ${t.sourcePath} is not valid UTF-8. It holds bytes that are no character in UTF-8, ` +
          'and no character is guessed in their place: save the file as UTF-8.',
      ],
      0,
    ],
    [
      // The mark is valid UTF-8, and it is a character of the file: the text hash of the record counts it too.
      'the guide source begins with a byte order mark: the mark is kept, so line 1 does not begin with its header comment',
      (t) => writeFileSync(t.sourcePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(GUIDE)])),
      () => printer(),
      () => ['guide line 1: the file must begin with its header comment, which opens with <!-- at the start of line 1.'],
      0,
    ],
    [
      'the Version: line of the guide\'s header comment is not the edition in the file name',
      (t) => writeFileSync(t.sourcePath, GUIDE.replace('  Version: 1.104.0\n', '  Version: 1.103.0\n')),
      () => printer(),
      () => [`renderGuidePdf: ${SOURCE_FILE} says "Version: 1.103.0" in its header comment, and its file name says 1.104.0. The two must be the same.`],
      0,
    ],
    [
      // The two are compared as they are written, to the last group: the one would be printed on the cover and in every footer.
      'the Version: line holds the edition\'s first two groups and not its third',
      (t) => writeFileSync(t.sourcePath, GUIDE.replace('  Version: 1.104.0\n', '  Version: 1.104\n')),
      () => printer(),
      () => [`renderGuidePdf: ${SOURCE_FILE} says "Version: 1.104" in its header comment, and its file name says 1.104.0. The two must be the same.`],
      0,
    ],
    [
      'the Version: line differs from the edition in its third group only',
      (t) => writeFileSync(t.sourcePath, GUIDE.replace('  Version: 1.104.0\n', '  Version: 1.104.1\n')),
      () => printer(),
      () => [`renderGuidePdf: ${SOURCE_FILE} says "Version: 1.104.1" in its header comment, and its file name says 1.104.0. The two must be the same.`],
      0,
    ],
    [
      'the guide holds a link, which the converter refuses, on line 20 of the file',
      (t) => writeFileSync(t.sourcePath, GUIDE.replace('Run the agent with `agent.env`.', 'Run the agent as [the docs](install.md) say.')),
      () => printer(),
      () => ['guide line 20: a link or an image, "](".'],
      0,
    ],
    [
      'the print step fails after it has written a whole PDF to its file',
      () => {},
      () => printer(PDF, new Error('the browser closed before the page was printed')),
      () => ['the browser closed before the page was printed'],
      1,
    ],
    ['the print step writes an empty file', () => {}, () => printer(Buffer.alloc(0)), () => ['renderGuidePdf: the print step wrote an empty file.'], 1],
    [
      'the print step writes a file that does not begin with %PDF-',
      () => {},
      () => printer(Buffer.from('<!doctype html><title>about:blank</title>\n%PDF-1.7\n')),
      () => ['renderGuidePdf: the print step wrote a file that does not begin with %PDF-, so it is not a PDF.'],
      1,
    ],
    [
      'the print step writes a file that begins with %PDF and no dash',
      () => {},
      () => printer(Buffer.from('%PDF 1.7\n%%EOF\n')),
      () => ['renderGuidePdf: the print step wrote a file that does not begin with %PDF-, so it is not a PDF.'],
      1,
    ],
    [
      // Shorter than the five bytes it must begin with. Were it put in place, the record step would refuse it too late.
      'the print step writes the four bytes %PDF and no more',
      () => {},
      () => printer(Buffer.from('%PDF')),
      () => ['renderGuidePdf: the print step wrote a file that does not begin with %PDF-, so it is not a PDF.'],
      1,
    ],
    [
      'the print step writes the one byte % and no more',
      () => {},
      () => printer(Buffer.from('%')),
      () => ['renderGuidePdf: the print step wrote a file that does not begin with %PDF-, so it is not a PDF.'],
      1,
    ],
    ['the print step ends without an error and writes no file', () => {}, () => printer(null), () => ['renderGuidePdf: the print step wrote no file.'], 1],
    ['the print template is missing', (t) => rmSync(t.templatePath), () => printer(), (t) => [`renderGuidePdf: cannot read the print template ${t.templatePath}.`], 0],
    [
      'the print template has lost its slot for the cover line',
      (t) => writeFileSync(t.templatePath, TEMPLATE.replace('<p>{{cover_line}}</p>', '')),
      () => printer(),
      () => ['fillGuideTemplate: the print template lacks {{cover_line}}.'],
      0,
    ],
  ])('refuses when %s: the message says so, and the served PDF and its record are as they were', async (_label, arrange, makePrinter, reasons, prints) => {
    for (const served of [false, true]) {
      const t = tree({ served });
      arrange(t);
      const before = filesOf(t.downloads);
      const p = makePrinter();
      const run = () => renderGuidePdf({ haiwebDir: t.web, haicoreDir: t.core, sourceFile: SOURCE_FILE, now: NOW, print: p.print });
      for (const reason of reasons(t)) await expect(run()).rejects.toThrow(reason);
      expect(p.calls.length).toBe(prints * reasons(t).length);
      expect(filesOf(t.downloads)).toEqual(before);
      expect(Object.keys(before)).toEqual(served ? ['.gitkeep', 'configuration-guide.json', 'configuration-guide.pdf'] : ['.gitkeep']);
    }
  });

  // The name rule of the record command holds here too. A guide is written at the very path the name points to, and the
  // tree's own guide stays in docs under the bare name: whichever of the two a looser check would read, it is there.
  it.each<[string, string, (t: Tree) => string]>([
    ['climbs out of docs', `../${SOURCE_FILE}`, (t) => join(t.core, SOURCE_FILE)],
    ['names a directory inside docs', `sub/${SOURCE_FILE}`, (t) => join(t.docs, 'sub', SOURCE_FILE)],
  ])('refuses a source file name that %s although a guide is at that very path: nothing is printed, and the served PDF and its record are as they were', async (_label, name, sourceAt) => {
    for (const served of [false, true]) {
      const t = tree({ served });
      mkdirSync(dirname(sourceAt(t)), { recursive: true });
      writeFileSync(sourceAt(t), GUIDE);
      expect(join(t.docs, name)).toBe(sourceAt(t));
      const before = filesOf(t.downloads);
      const p = printer();
      await expect(renderGuidePdf({ ...runOptions(t, p.print), sourceFile: name })).rejects.toThrow(`${JSON.stringify(name)} is not a guide source file name`);
      expect(p.calls).toEqual([]);
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  it('removes its print when the PDF cannot be put in place, here because a directory stands under the PDF\'s name', async () => {
    const t = tree();
    mkdirSync(t.pdfPath);
    const p = printer();
    await expect(renderGuidePdf(runOptions(t, p.print))).rejects.toThrow();
    expect(p.calls).toHaveLength(1);
    expect(readdirSync(t.downloads).sort()).toEqual(['.gitkeep', 'configuration-guide.pdf']);
    expect(readdirSync(t.pdfPath)).toEqual([]);
  });

  // Once the new PDF is in place nothing is undone. A failure of the record step is passed on as what it is, so that
  // the command can say that the PDF is new and its record is not. Here the guide source is gone when the record is made.
  it('marks a failure that comes after the new PDF is in place: the error carries pdfReplaced, the PDF is the new one, and the record is as it was', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const p = printer();
      const print = async (html: string, outPath: string) => {
        await p.print(html, outPath);
        rmSync(t.sourcePath);
      };
      const failure: unknown = await renderGuidePdf(runOptions(t, print)).then(() => null, (err: unknown) => err);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain(`recordGuidePdf: cannot read the guide source ${t.sourcePath}.`);
      expect(failure).toMatchObject({ pdfReplaced: true });
      expect(filesOf(t.downloads)).toEqual({
        '.gitkeep': '',
        'configuration-guide.pdf': PDF.toString('hex'),
        ...(served ? { 'configuration-guide.json': OLD_RECORD.toString('hex') } : {}),
      });
    }
  });

  // No guide that the converter accepts makes the check of its output fail, so the converter is swapped here for one
  // that loses a heading. The check must catch that before anything is printed.
  it('refuses when the converted HTML does not match the markdown: the converter\'s output is checked before it is printed', async () => {
    vi.resetModules();
    vi.doMock('../guide-markdown.mjs', async () => {
      const real = await vi.importActual<typeof import('../guide-markdown.mjs')>('../guide-markdown.mjs');
      const guideMarkdownToHtml = (body: string, options?: { firstLine?: number }) =>
        real.guideMarkdownToHtml(body, options).replace('<h2>§1 First Steps</h2>\n', '');
      return { ...real, guideMarkdownToHtml };
    });
    try {
      const withLossyConverter = await import('../render-guide-pdf.mjs');
      for (const served of [false, true]) {
        const t = tree({ served });
        const before = filesOf(t.downloads);
        const p = printer();
        await expect(withLossyConverter.renderGuidePdf(runOptions(t, p.print))).rejects.toThrow(
          'the guide\'s HTML does not match its markdown:\n- section headings: 1 "## " lines in the markdown, 0 <h2> in the HTML',
        );
        expect(p.calls).toEqual([]);
        expect(filesOf(t.downloads)).toEqual(before);
      }
    } finally {
      vi.doUnmock('../guide-markdown.mjs');
      vi.resetModules();
    }
  });
});

describe('main', () => {
  /** main over the tree with a print step, and every log and warn line it gave. */
  async function run(t: Tree, args: string[], print: ReturnType<typeof printer>['print'] = printer().print) {
    const logs: string[] = [];
    const warns: string[] = [];
    const code = await main({ args, haiwebDir: t.web, haicoreDir: t.core, now: NOW, print, log: (m: string) => logs.push(m), warn: (m: string) => warns.push(m) });
    return { code, logs, warns };
  }

  it('renders the guide in <haiCore>/docs into <haiWeb>/private/agent-downloads and records it, logs one line and resolves to 0', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      expect(await run(t, [SOURCE_FILE])).toEqual({
        code: 0,
        logs: [
          `Rendered configuration-guide.pdf (${PDF.length} bytes, sha256 ${bytesSha(PDF)}) from ${SOURCE_FILE}, edition 1.104.0 → recorded in configuration-guide.json`,
        ],
        warns: [],
      });
      expect(readFileSync(t.pdfPath)).toEqual(PDF);
      expect(JSON.parse(readFileSync(t.recordPath, 'utf8'))).toEqual({
        bodySha256: bytesSha(PDF), edition: '1.104.0', sourceFile: SOURCE_FILE, sourceSha256: textSha(GUIDE), builtAt: NOW.toISOString(),
      });
    }
  });

  // The command's own run passes no log and no warn: the one line of a good run goes to stdout, a refusal to stderr.
  it('logs with console.log and warns with console.error when it is given neither', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const t = tree();
      expect(await main({ args: [SOURCE_FILE], haiwebDir: t.web, haicoreDir: t.core, now: NOW, print: printer().print })).toBe(0);
      expect([log.mock.calls.length, error.mock.calls.length]).toEqual([1, 0]);
      expect(log.mock.calls[0][0]).toMatch(/^Rendered configuration-guide\.pdf /);
      expect(await main({ args: [], haiwebDir: t.web, haicoreDir: t.core, now: NOW, print: printer().print })).toBe(1);
      expect([log.mock.calls.length, error.mock.calls.length]).toEqual([1, 1]);
      expect(error.mock.calls[0][0]).toMatch(/^render:guide-pdf takes exactly one argument/);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  const USAGE = 'Usage: HAICORE_DIR=<haiCore checkout> npm run render:guide-pdf -- client-implementation-guidelines-v<version>.md';
  /**
   * A run that was refused before anything was put in place: it resolves to 1, logs nothing, and gives one warning
   * that holds the reason, the words that nothing was changed, and the usage line, with no stack trace in it.
   */
  function expectRefusal(r: Awaited<ReturnType<typeof run>>, reason: string) {
    expect(r.code).toBe(1);
    expect(r.logs).toEqual([]);
    expect(r.warns).toHaveLength(1);
    expect(r.warns[0]).toBe(`${reason}\nRefused: the served PDF and its record were not changed.\n${USAGE}`);
    expect(r.warns[0]).not.toMatch(/\n\s+at /);
  }

  /** What the name rule says of an argument that is not a guide source's bare file name. */
  const notAName = (name: string) =>
    `parseGuideSourceFile: ${JSON.stringify(name)} is not a guide source file name. Give the bare file name ` +
    'client-implementation-guidelines-v<version>.md, where <version> is two or more groups of digits joined by single dots, ' +
    'with no directory before it and nothing after it.';

  // Each refusal is tried twice, in a fresh tree each time: in a downloads directory that holds no guide yet, and in
  // one that serves the edition before. Afterwards the directory holds the same files with the same bytes.
  it.each<[string, string[], string]>([
    ['a run with no argument', [], 'render:guide-pdf takes exactly one argument, the guide source\'s bare file name, and 0 came.'],
    [
      'two arguments, the first of them the guide\'s name',
      [SOURCE_FILE, 'client-implementation-guidelines-v1.7.md'],
      'render:guide-pdf takes exactly one argument, the guide source\'s bare file name, and 2 came.',
    ],
    ['a flag, for the command has none: --help', ['--help'], notAName('--help')],
  ])('refuses %s: resolves to 1 after one warning with the reason, the refusal and the usage line, and prints nothing', async (_label, args, reason) => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const before = filesOf(t.downloads);
      const p = printer();
      expectRefusal(await run(t, args, p.print), reason);
      expect(p.calls).toEqual([]);
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  // The argument reaches the name rule as it was typed: a directory part is not cut off first.
  it('refuses a name that climbs out of docs although a guide is at that very path, and prints nothing', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      writeFileSync(join(t.core, SOURCE_FILE), GUIDE);
      const before = filesOf(t.downloads);
      const p = printer();
      expectRefusal(await run(t, [`../${SOURCE_FILE}`], p.print), notAName(`../${SOURCE_FILE}`));
      expect(p.calls).toEqual([]);
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  it('a refusal that comes from the render itself (the print step fails) comes out the same way, and nothing is thrown', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const before = filesOf(t.downloads);
      const p = printer(PDF, new Error('the browser closed before the page was printed'));
      expectRefusal(await run(t, [SOURCE_FILE], p.print), 'the browser closed before the page was printed');
      expect(p.calls).toHaveLength(1);
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  // A print step can fail with something that is not an Error, and the command still gives its one warning.
  it('gives the same one warning for a failure that is not an Error: here the print step rejects with a string', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const before = filesOf(t.downloads);
      expectRefusal(await run(t, [SOURCE_FILE], () => Promise.reject('the print step gave up')), 'the print step gave up');
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  // The guide source is gone when the record is made, so the record step fails once the new PDF is in place.
  it('says that the PDF was replaced and that its record must be made again when the failure comes after the new PDF is in place', async () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const p = printer();
      const print = async (html: string, outPath: string) => {
        await p.print(html, outPath);
        rmSync(t.sourcePath);
      };
      const r = await run(t, [SOURCE_FILE], print);
      expect([r.code, r.logs, r.warns.length]).toEqual([1, [], 1]);
      expect(r.warns[0]).toBe(
        `recordGuidePdf: cannot read the guide source ${t.sourcePath}. Set HAICORE_DIR to the haiCore checkout that holds it.\n` +
          'The served PDF was replaced and its record was not made. Make the record again: npm run record:guide-pdf -- <guide source file>\n' +
          USAGE,
      );
      expect(r.warns[0]).not.toContain('were not changed');
      expect(r.warns[0]).not.toMatch(/\n\s+at /);
      expect(readFileSync(t.pdfPath)).toEqual(PDF);
    }
  });
});

// Every run here is refused before the print step, so none of them needs a browser.
describe('the CLI (node scripts/render-guide-pdf.mjs)', () => {
  // The script beside this file, by its real path.
  const SCRIPT = realpathSync(fileURLToPath(new URL('../render-guide-pdf.mjs', import.meta.url)));
  const REFUSED_AND_USAGE =
    'Refused: the served PDF and its record were not changed.\n' +
    'Usage: HAICORE_DIR=<haiCore checkout> npm run render:guide-pdf -- client-implementation-guidelines-v<version>.md\n';
  /** `node <argv…>` with the tree's haiWeb directory as the working directory. HAICORE_DIR is `haicoreDir`, or is unset when that is null. */
  function node(t: Tree, argv: string[], haicoreDir: string | null = t.core) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.HAICORE_DIR;
    if (haicoreDir !== null) env.HAICORE_DIR = haicoreDir;
    return spawnSync(process.execPath, argv, { cwd: t.web, env, encoding: 'utf8' });
  }

  it('a run with no argument exits 1 with the reason, the refusal and the usage line on stderr, no stack trace, and nothing made or changed', () => {
    for (const served of [false, true]) {
      const t = tree({ served });
      const before = filesOf(t.downloads);
      const r = node(t, [SCRIPT]);
      expect([r.status, r.stdout]).toEqual([1, '']);
      expect(r.stderr).toBe(`render:guide-pdf takes exactly one argument, the guide source's bare file name, and 0 came.\n${REFUSED_AND_USAGE}`);
      expect(filesOf(t.downloads)).toEqual(before);
    }
  });

  // A directory that holds no guide is named as the checkout, so the run is refused where it reads the guide, and the
  // path in the refusal shows where it looked.
  it('reads the guide from the haiCore checkout that HAICORE_DIR names', () => {
    const t = tree({ served: true });
    const before = filesOf(t.downloads);
    const elsewhere = join(dirname(t.web), 'elsewhere');
    const r = node(t, [SCRIPT, SOURCE_FILE], elsewhere);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(
      `renderGuidePdf: cannot read the guide source ${join(elsewhere, 'docs', SOURCE_FILE)}. Set HAICORE_DIR to the haiCore checkout that holds it.\n${REFUSED_AND_USAGE}`,
    );
    expect(filesOf(t.downloads)).toEqual(before);
  });

  // The tree's haiCore directory is named core, so nothing is at ../haiCore, and the refusal shows that path.
  it('reads the guide from ../haiCore, beside the directory it is run in, when HAICORE_DIR is unset', () => {
    const t = tree({ served: true });
    const before = filesOf(t.downloads);
    const r = node(t, [SCRIPT, SOURCE_FILE], null);
    const sourcePath = join(realpathSync(dirname(t.web)), 'haiCore', 'docs', SOURCE_FILE);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(`renderGuidePdf: cannot read the guide source ${sourcePath}. Set HAICORE_DIR to the haiCore checkout that holds it.\n${REFUSED_AND_USAGE}`);
    expect(filesOf(t.downloads)).toEqual(before);
  });

  // The guide is there and the template is not, so the run is refused where it reads the template, and the path in
  // the refusal shows where it looked.
  it('takes the directory it is run in for the haiWeb directory: the print template is looked for there', () => {
    const t = tree({ served: true });
    rmSync(t.templatePath);
    const before = filesOf(t.downloads);
    const r = node(t, [SCRIPT, SOURCE_FILE]);
    const templatePath = join(realpathSync(t.web), 'design', 'configuration-guide', 'guide-template.html');
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(`renderGuidePdf: cannot read the print template ${templatePath}. Run the command in the haiWeb directory.\n${REFUSED_AND_USAGE}`);
    expect(filesOf(t.downloads)).toEqual(before);
  });

  /** What a run with no argument prints on stderr: the command started, and refused before it read anything. */
  const NO_ARGUMENT = `render:guide-pdf takes exactly one argument, the guide source's bare file name, and 0 came.\n${REFUSED_AND_USAGE}`;

  // The importing script is given no argument: a command that did start on import would exit 1 with the usage line.
  it('does nothing when another script imports it: the import gives the functions, and the command does not start', () => {
    const t = tree({ served: true });
    const before = filesOf(t.downloads);
    const importer = join(realpathSync(tmp('render-importer-')), 'importer.mjs');
    writeFileSync(importer, `const render = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\nconsole.log(typeof render.main);\n`);
    const r = node(t, [importer]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, 'function\n', '']);
    expect(filesOf(t.downloads)).toEqual(before);
  });

  // The entry check must hold wherever the checkout is. A file URL writes a space as %20, so a check that compares
  // import.meta.url with a hand-built file://<argv[1]> is false in such a path: the command prints nothing and exits 0.
  // The script is copied with the two files it imports.
  it('runs from a copy in a directory whose name holds a space', () => {
    const dir = realpathSync(tmp('render check out-'));
    expect(dir).toContain(' ');
    for (const file of ['render-guide-pdf.mjs', 'guide-markdown.mjs', 'record-guide-pdf.mjs']) copyFileSync(join(dirname(SCRIPT), file), join(dir, file));
    const r = node(tree(), [join(dir, 'render-guide-pdf.mjs')]);
    expect([r.status, r.stdout, r.stderr]).toEqual([1, '', NO_ARGUMENT]);
  });

  // Started through a symlink, argv[1] is the link while import.meta.url is the file the link points to. Compared as
  // given the two never match, and the command would do nothing and exit 0.
  it('runs when it is started through a symlink to the script', () => {
    const link = join(realpathSync(tmp('render-link-')), 'render-guide-pdf.mjs');
    symlinkSync(SCRIPT, link);
    const r = node(tree(), [link]);
    expect([r.status, r.stdout, r.stderr]).toEqual([1, '', NO_ARGUMENT]);
  });

  // The entry check takes real paths, and a path that names no file has none. A process whose argv[1] is such a path
  // is importing the module: the import must not throw, and it must not start the command.
  it('stays importable, and does not run, in a process whose argv[1] names no file', () => {
    const t = tree();
    const code = `process.argv[1] = ${JSON.stringify(join(t.web, 'no-such-entry.mjs'))}; const render = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)}); console.log(typeof render.main);`;
    const r = node(t, ['--input-type=module', '-e', code]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, 'function\n', '']);
  });
});

describe('end to end: the real converter and the committed print template', () => {
  /**
   * A guide body that uses every construct the guide's markdown has: both headings, a paragraph over several lines with
   * a code span across a line break, the three kinds of list, code blocks in bash, in ts and with no language, a table
   * of six columns, the three kinds of note, rules, bold, italic, bold italic, bold around a code span, and comments
   * alone on a line and beside text.
   */
  const BODY_LINES = [
    '<!-- a comment alone on its line -->',
    '## Contents',
    '',
    '**Enter here**',
    '- §0 How to fix this sheet',
    '- §1 First Steps',
    '',
    '---',
    '',
    '## §1 First Steps',
    '',
    "*Audience: A (every visitor's third week)*",
    '',
    'From a registered account to a working index, in two steps: get the container, <!-- a cite beside text -->',
    "and run it with a file named `agent.env`. The response is `{kind: 'value',",
    'nonce}` for a value. Set it to **`true`** to turn it on.',
    '',
    '### §1.1 What you want',
    '',
    '1. **The Free Agent archive.** At ***Account › Agent Software***.',
    '2. Second item with `PARTICIPANT_ID`.',
    '',
    '- [ ] A check-box item.',
    '- [ ] A second one, *with italic*.',
    '',
    '```bash',
    'PARTICIPANT_ID=<yours>',
    'docker run -d --name example-agent \\',
    '  -p 3001:3001 example-agent  # <!-- kept --> && done',
    '```',
    '',
    '```ts',
    'if (!result.ok) throw new Error(`extract failed: ${result.error.code}`);',
    '```',
    '',
    '```',
    'a block with no language',
    '```',
    '',
    '> **Planned.** Not yet available.',
    '',
    '> **Conventions.** Configuration is given as a variable (`MONOSPACE`).',
    '',
    '> A note with no label.',
    '',
    '| Field | Internal | Premier | Sharing Pair | Connection | Qualified |',
    '|---|---|---|---|---|---|',
    '| Name / SKU | ✓ | ✓ | ✓ | ✓ | ✓ |',
    '| `PORT` | `3001` | – | – | – | – |',
    '',
    '---',
    '',
  ];
  /** The small guide's header comment and cover (its lines 1 to 15), then that body. */
  const FULL_GUIDE = [...GUIDE_LINES.slice(0, 15), ...BODY_LINES].join('\n');
  const COMMITTED_TEMPLATE = fileURLToPath(new URL(`../../${GUIDE_TEMPLATE_FILE}`, import.meta.url));

  it('renders a guide that uses every construct through the committed template, and records the PDF that was put in place', async () => {
    const t = tree({ served: true });
    copyFileSync(COMMITTED_TEMPLATE, t.templatePath);
    writeFileSync(t.sourcePath, FULL_GUIDE);
    const p = printer();
    const { record } = await renderGuidePdf(runOptions(t, p.print));
    expect(p.calls).toHaveLength(1);
    const { html } = p.calls[0];

    // Every heading of the guide, as the converter writes it.
    const headings = BODY_LINES.filter((line) => line.startsWith('#'));
    expect(headings).toEqual(['## Contents', '## §1 First Steps', '### §1.1 What you want']);
    for (const heading of headings) {
      const level = heading.indexOf(' ');
      expect(html).toContain(`<h${level}>${heading.slice(level + 1)}</h${level}>`);
    }
    // A command, character for character but for the three entities.
    expect(html).toContain(
      '<pre><code class="language-bash">PARTICIPANT_ID=&lt;yours&gt;\ndocker run -d --name example-agent \\\n  -p 3001:3001 example-agent  # &lt;!-- kept --&gt; &amp;&amp; done\n</code></pre>',
    );
    // The cover and the running footer: the title, the cover line, the version and the date.
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Free Agent SCM: Install &amp; Configure</title>');
    expect(html).toContain('<h1 class="cover-title">Free Agent SCM: Install &amp; Configure</h1>');
    expect(html).toContain('<p class="cover-line">Sample Administration Notes · Version 1.104.0 (platform level v1.104) · CONFIDENTIAL</p>');
    expect(html).toContain('<span class="cover-version">1.104.0</span><span class="cover-date">2026-10-06</span>');
    expect(html).toMatch(/content:"1\.104\.0[^"]*2026-10-06";/);
    // No slot is left, and no text of a comment outside a code block came through.
    expect(html).not.toContain('{{');
    expect(html).not.toContain('a comment alone on its line');
    expect(html).not.toContain('a cite beside text');

    // The record is the record of the PDF that is now served: what publish:help-pack checks before it publishes.
    expect(readFileSync(t.pdfPath)).toEqual(PDF);
    expect(record.bodySha256).toBe(sha256OfFile(t.pdfPath));
    expect(record).toEqual({ bodySha256: bytesSha(PDF), edition: '1.104.0', sourceFile: SOURCE_FILE, sourceSha256: textSha(FULL_GUIDE), builtAt: NOW.toISOString() });
    expect(JSON.parse(readFileSync(t.recordPath, 'utf8'))).toEqual(record);
  });
});

describe('package.json', () => {
  it('has the script "render:guide-pdf": "node scripts/render-guide-pdf.mjs"', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
    expect(pkg.scripts['render:guide-pdf']).toBe('node scripts/render-guide-pdf.mjs');
  });
});

describe('the print settings', () => {
  // The template sets its own page size and margins, paints its cover and its code blocks with backgrounds, and the
  // PDF carries its tags and its outline of headings.
  it('GUIDE_PDF_OPTIONS is exactly: the page size of the CSS, backgrounds printed, a tagged PDF, an outline', () => {
    expect(GUIDE_PDF_OPTIONS).toEqual({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  });

  // The print step itself needs a browser, so no test runs it: every test hands the render a print step of its own.
  it('printGuidePdf, the print step of a real run, is a function of the page and the path to print to', () => {
    expect(typeof printGuidePdf).toBe('function');
    expect(printGuidePdf).toHaveLength(2);
  });

  // The template needs no script, and the guide's text must never run as one.
  it('GUIDE_BROWSER_CONTEXT_OPTIONS is exactly: JavaScript off', () => {
    expect(GUIDE_BROWSER_CONTEXT_OPTIONS).toEqual({ javaScriptEnabled: false });
  });
});
