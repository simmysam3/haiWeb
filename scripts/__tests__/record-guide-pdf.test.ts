// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HelpPackManifestSchema } from '@haiwave/protocol';
import { GUIDE_PDF_FILE, GUIDE_RECORD_FILE, sha256OfFile, parseGuideSourceFile, recordGuidePdf, main } from '../record-guide-pdf.mjs';

const created: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); created.push(d); return d; };
afterEach(() => { created.forEach((d) => rmSync(d, { recursive: true, force: true })); created.length = 0; });

/** A stand-in for the served PDF: it begins with %PDF- and holds bytes that are not valid UTF-8, so the hash of its text is not the hash of its bytes. */
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from([0xff, 0xfe, 0x00]), Buffer.from('\n%%EOF\n')]);
const SOURCE_FILE = 'client-implementation-guidelines-v1.104.0.md';
/** The guide source, with a byte that is not valid UTF-8 in it too: the record holds the hash of its text, not of its bytes. */
const SOURCE = Buffer.concat([Buffer.from('# Guide\n'), Buffer.from([0xff]), Buffer.from('\n## Quick Start\nRun it.\n')]);
const NOW = new Date('2026-10-07T11:00:00.000Z');
const bytesSha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const textSha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('the two file names', () => {
  // The console serves the PDF under exactly this name, and reads the record beside it under exactly that one.
  it('are configuration-guide.pdf and configuration-guide.json', () => {
    expect([GUIDE_PDF_FILE, GUIDE_RECORD_FILE]).toEqual(['configuration-guide.pdf', 'configuration-guide.json']);
  });
});

describe('sha256OfFile', () => {
  it('is the SHA-256 of the file\'s raw bytes, which is not the hash of its text when the file is not valid UTF-8', () => {
    const path = join(tmp('record-sha-'), 'configuration-guide.pdf');
    writeFileSync(path, PDF);
    expect(textSha(readFileSync(path, 'utf8'))).not.toBe(bytesSha(PDF));
    expect(sha256OfFile(path)).toBe(bytesSha(PDF));
  });
});

// The server's two rules for the name: the protocol's pattern for manifest.guide.source_file, and the edition that
// haiCore's pack validation reads out of the name and compares with manifest.guide.edition.
const protocolAccepts = (name: string) => HelpPackManifestSchema.shape.guide.shape.source_file.safeParse(name).success;
const editionTheServerReads = (name: string) => /-v([\d.]+)\.md$/.exec(name)?.[1];

describe('parseGuideSourceFile', () => {
  it.each([
    ['three groups of digits', 'client-implementation-guidelines-v1.104.0.md', '1.104.0'],
    ['two groups of digits', 'client-implementation-guidelines-v1.7.md', '1.7'],
  ])('accepts a version of %s; the protocol accepts the name too, and the server reads the same edition from it', (_label, name, edition) => {
    expect(parseGuideSourceFile(name)).toEqual({ sourceFile: name, edition });
    expect(protocolAccepts(name)).toBe(true);
    expect(editionTheServerReads(name)).toBe(edition);
  });

  it.each([
    ['the pointer file, whose name has no version', 'client-implementation-guidelines.md'],
    ['a pre-release suffix', 'client-implementation-guidelines-v1.104.0-rc.1.md'],
    ['a directory before the name', 'docs/client-implementation-guidelines-v1.104.0.md'],
    ['a path that climbs out of docs', '../client-implementation-guidelines-v1.104.0.md'],
    ['an absolute path', '/srv/haiCore/docs/client-implementation-guidelines-v1.104.0.md'],
    ['two dots in a row in the version', 'client-implementation-guidelines-v1..0.md'],
    ['a version of one group of digits', 'client-implementation-guidelines-v1.md'],
    ['a space after the name', 'client-implementation-guidelines-v1.104.0.md '],
    ['a line break after the name', 'client-implementation-guidelines-v1.104.0.md\n'],
    ['the empty string', ''],
    ['upper-case letters', 'client-implementation-guidelines-V1.104.0.MD'],
    ['another character where the dot before md goes', 'client-implementation-guidelines-v1.104.0-md'],
    ['a version joined by something other than dots', 'client-implementation-guidelines-v1-104-0.md'],
    // Each of the next three differs from a good name in one place only.
    ['an upper-case V before the version, with the rest in lower case', 'client-implementation-guidelines-V1.104.0.md'],
    ['an upper-case MD at the end, with the rest in lower case', 'client-implementation-guidelines-v1.104.0.MD'],
    ['a version with no v before it', 'client-implementation-guidelines-1.104.0.md'],
  ])('refuses %s, and the message quotes the name', (_label, name) => {
    expect(() => parseGuideSourceFile(name)).toThrow(`${JSON.stringify(name)} is not a guide source file name`);
  });
});

/** A haiWeb tree that holds the PDF and a haiCore tree that holds the guide source, side by side in one temp directory. */
function tree(over: { coreName?: string } = {}) {
  const root = tmp('record-guide-');
  const web = join(root, 'web');
  const core = join(root, over.coreName ?? 'core');
  const downloads = join(web, 'private', 'agent-downloads');
  const docs = join(core, 'docs');
  mkdirSync(downloads, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const pdfPath = join(downloads, 'configuration-guide.pdf');
  const sourcePath = join(docs, SOURCE_FILE);
  writeFileSync(pdfPath, PDF);
  writeFileSync(sourcePath, SOURCE);
  return { web, core, downloads, docs, pdfPath, sourcePath, recordPath: join(downloads, 'configuration-guide.json') };
}

/**
 * A good file name behind a directory part, and the path that name points to from <haiCore>/docs. The tests write a
 * guide source at that path, and the tree's own source stays in docs under the bare name: whichever of the two a looser
 * check would read, it is there, so the name rule is the only thing left to refuse the run.
 */
const NAMES_WITH_A_DIRECTORY: Array<[string, string, (t: ReturnType<typeof tree>) => string]> = [
  ['a path that climbs out of docs', `../${SOURCE_FILE}`, (t) => join(t.core, SOURCE_FILE)],
  ['a directory inside docs', `sub/${SOURCE_FILE}`, (t) => join(t.docs, 'sub', SOURCE_FILE)],
];
/** Write a guide source at `path`, and check that it is the file `name` points to from <haiCore>/docs. */
function writeSourceAt(t: ReturnType<typeof tree>, name: string, path: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, SOURCE);
  expect(join(t.docs, name)).toBe(path);
  expect(readFileSync(t.sourcePath)).toEqual(SOURCE);
}

describe('recordGuidePdf', () => {
  it('writes configuration-guide.json beside the PDF: five keys in this order, as JSON.stringify(record, null, 2) and a line break', () => {
    const t = tree();
    recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    const record = {
      bodySha256: bytesSha(PDF),
      edition: '1.104.0',
      sourceFile: SOURCE_FILE,
      sourceSha256: textSha(readFileSync(t.sourcePath, 'utf8')),
      builtAt: '2026-10-07T11:00:00.000Z',
    };
    expect(readFileSync(t.recordPath, 'utf8')).toBe(JSON.stringify(record, null, 2) + '\n');
  });

  it('returns the record it wrote and the number of bytes in the PDF', () => {
    const t = tree();
    const { record, pdfBytes } = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    expect(Object.keys(record)).toEqual(['bodySha256', 'edition', 'sourceFile', 'sourceSha256', 'builtAt']);
    expect(record).toEqual(JSON.parse(readFileSync(t.recordPath, 'utf8')));
    expect(pdfBytes).toBe(PDF.length);
  });

  it('stamps builtAt with the time of the run when no now is passed', () => {
    const t = tree();
    const before = Date.now();
    const { record } = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE });
    const after = Date.now();
    expect(new Date(record.builtAt).toISOString()).toBe(record.builtAt);
    expect(Date.parse(record.builtAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(record.builtAt)).toBeLessThanOrEqual(after);
  });

  // publish:help-pack hashes the same source as text and compares the two, so this side must never move to raw bytes.
  it('records the hash of the source read as UTF-8 text, which is not the hash of its bytes when a byte is not valid UTF-8', () => {
    const t = tree();
    const { record } = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    expect(record.sourceSha256).toBe(textSha(readFileSync(t.sourcePath, 'utf8')));
    expect(record.sourceSha256).not.toBe(bytesSha(readFileSync(t.sourcePath)));
  });

  // Each refusal is tried twice, in a fresh tree each time: with no record there, and with the record of an earlier PDF there.
  it.each<[string, (t: ReturnType<typeof tree>) => void, (t: ReturnType<typeof tree>) => string[]]>([
    ['the PDF is missing', (t) => rmSync(t.pdfPath), (t) => [`${t.pdfPath} is missing`]],
    ['a directory stands where the PDF goes', (t) => { rmSync(t.pdfPath); mkdirSync(t.pdfPath); }, (t) => [`${t.pdfPath} is not a regular file`]],
    ['the PDF is an empty file', (t) => writeFileSync(t.pdfPath, ''), (t) => [`${t.pdfPath} is empty`]],
    ['the file is an HTML page saved under the PDF\'s name', (t) => writeFileSync(t.pdfPath, '<!doctype html><title>Sign in</title><p>The guide is a %PDF-1.4 file.</p>\n'), (t) => [`${t.pdfPath} does not begin with %PDF-`]],
    ['the file begins with %PDF, with no dash after it', (t) => writeFileSync(t.pdfPath, '%PDF 1.4\n'), (t) => [`${t.pdfPath} does not begin with %PDF-`]],
    ['the guide source is missing', (t) => rmSync(t.sourcePath), (t) => [`cannot read the guide source ${t.sourcePath}`, 'HAICORE_DIR']],
  ])('refuses when %s: the message says so and names the path, no record is created, and one that is there stays as it was', (_label, arrange, expected) => {
    for (const earlier of [null, Buffer.from('{ "bodySha256": "the record of an earlier PDF" }\n')]) {
      const t = tree();
      if (earlier) writeFileSync(t.recordPath, earlier);
      arrange(t);
      const run = () => recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
      for (const text of expected(t)) expect(run).toThrow(text);
      if (earlier) expect(readFileSync(t.recordPath)).toEqual(earlier);
      else expect(existsSync(t.recordPath)).toBe(false);
    }
  });

  // The name rule holds here too, and not only in parseGuideSourceFile: a good file name behind a directory part is refused even with a source at that path.
  it.each(NAMES_WITH_A_DIRECTORY)('refuses %s although a source is at that very path: the message quotes the name, no record is created, and one that is there stays as it was', (_label, name, sourceAt) => {
    for (const earlier of [null, Buffer.from('{ "bodySha256": "the record of an earlier PDF" }\n')]) {
      const t = tree();
      writeSourceAt(t, name, sourceAt(t));
      if (earlier) writeFileSync(t.recordPath, earlier);
      const run = () => recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: name, now: NOW });
      expect(run).toThrow(`${JSON.stringify(name)} is not a guide source file name`);
      if (earlier) expect(readFileSync(t.recordPath)).toEqual(earlier);
      else expect(existsSync(t.recordPath)).toBe(false);
    }
  });

  it('a second run over a changed PDF replaces the record: a new bodySha256 and a new builtAt', () => {
    const t = tree();
    const first = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    const changed = Buffer.concat([PDF, Buffer.from([0x80])]);
    writeFileSync(t.pdfPath, changed);
    const later = new Date('2026-10-08T09:30:00.000Z');
    const second = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: later });
    expect(second.record).toEqual({ ...first.record, bodySha256: bytesSha(changed), builtAt: later.toISOString() });
    expect(second.record.bodySha256).not.toBe(first.record.bodySha256);
    expect(second.pdfBytes).toBe(PDF.length + 1);
    expect(readFileSync(t.recordPath, 'utf8')).toBe(JSON.stringify(second.record, null, 2) + '\n');
  });

  // The stand-in PDF of the other tests is a few bytes, and the served one is megabytes. This one is built in memory.
  it('hashes a PDF larger than 64 KiB whole: bodySha256 is the hash of every byte, and a change in the last byte alone changes it', () => {
    const t = tree();
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200 * 1024, 0xa5), Buffer.from([0x01])]);
    writeFileSync(t.pdfPath, big);
    expect(sha256OfFile(t.pdfPath)).toBe(bytesSha(big));
    const first = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    expect(first.record.bodySha256).toBe(bytesSha(big));
    expect(first.pdfBytes).toBe(big.length);

    const other = Buffer.from(big);
    other[other.length - 1] = 0x02;
    writeFileSync(t.pdfPath, other);
    expect(bytesSha(other)).not.toBe(bytesSha(big));
    const second = recordGuidePdf({ downloadsDir: t.downloads, haicoreDocsDir: t.docs, sourceFile: SOURCE_FILE, now: NOW });
    expect(second.record.bodySha256).toBe(bytesSha(other));
  });
});

/** The one line a successful run prints. */
const recordedLine = (t: ReturnType<typeof tree>) =>
  `Recorded configuration-guide.pdf (${PDF.length} bytes, sha256 ${bytesSha(PDF)}) as edition 1.104.0, source ${SOURCE_FILE} ` +
  `(sha256 ${textSha(readFileSync(t.sourcePath, 'utf8'))}) → configuration-guide.json`;

describe('main', () => {
  /** main over the tree, with every log and warn line it gave. */
  function run(t: ReturnType<typeof tree>, args: string[]) {
    const logs: string[] = [];
    const warns: string[] = [];
    const code = main({ args, haiwebDir: t.web, haicoreDir: t.core, now: NOW, log: (m: string) => logs.push(m), warn: (m: string) => warns.push(m) });
    return { code, logs, warns };
  }

  it('records the PDF in <haiWeb>/private/agent-downloads against the source in <haiCore>/docs, logs one line and returns 0', () => {
    const t = tree();
    expect(run(t, [SOURCE_FILE])).toEqual({ code: 0, logs: [recordedLine(t)], warns: [] });
    expect(JSON.parse(readFileSync(t.recordPath, 'utf8'))).toEqual({
      bodySha256: bytesSha(PDF), edition: '1.104.0', sourceFile: SOURCE_FILE, sourceSha256: textSha(readFileSync(t.sourcePath, 'utf8')), builtAt: NOW.toISOString(),
    });
  });

  const USAGE = 'Usage: HAICORE_DIR=<haiCore checkout> npm run record:guide-pdf -- client-implementation-guidelines-v<version>.md';
  const EARLIER = Buffer.from('{ "bodySha256": "the record of an earlier PDF" }\n');
  /** A refused run: exit code 1, nothing logged, and one warning that holds the reason, the refusal and the usage line, with no stack trace in it. */
  function expectRefusal(r: ReturnType<typeof run>, reason: string) {
    expect(r.code).toBe(1);
    expect(r.logs).toEqual([]);
    expect(r.warns).toHaveLength(1);
    expect(r.warns[0]).toContain(reason);
    expect(r.warns[0]).toContain('Refused: nothing was written.');
    expect(r.warns[0]).toContain(USAGE);
    expect(r.warns[0]).not.toMatch(/\n\s+at /);
  }

  // Each refusal is tried twice, in a fresh tree each time: with no record there, and with the record of an earlier PDF there.
  it.each<[string, string[], string]>([
    ['a flag, for the command has none: --help', ['--help'], '"--help" is not a guide source file name'],
    ['a run with no argument', [], 'takes exactly one argument, the guide source\'s bare file name, and 0 came'],
    ['two arguments, each a good name', [SOURCE_FILE, 'client-implementation-guidelines-v1.7.md'], 'takes exactly one argument, the guide source\'s bare file name, and 2 came'],
    ['another flag, which is not a dry run: --dry-run', ['--dry-run'], '"--dry-run" is not a guide source file name'],
  ])('refuses %s: returns 1 after one warning with the reason, the refusal and the usage line, and writes nothing', (_label, args, reason) => {
    for (const earlier of [null, EARLIER]) {
      const t = tree();
      if (earlier) writeFileSync(t.recordPath, earlier);
      expectRefusal(run(t, args), reason);
      if (earlier) expect(readFileSync(t.recordPath)).toEqual(earlier);
      else expect(existsSync(t.recordPath)).toBe(false);
    }
  });

  // The argument reaches the name rule as it was typed: a directory part is not cut off first.
  it.each(NAMES_WITH_A_DIRECTORY)('refuses %s although a source is at that very path: returns 1 after one warning that quotes the argument, and writes nothing', (_label, arg, sourceAt) => {
    for (const earlier of [null, EARLIER]) {
      const t = tree();
      writeSourceAt(t, arg, sourceAt(t));
      if (earlier) writeFileSync(t.recordPath, earlier);
      expectRefusal(run(t, [arg]), `${JSON.stringify(arg)} is not a guide source file name`);
      if (earlier) expect(readFileSync(t.recordPath)).toEqual(earlier);
      else expect(existsSync(t.recordPath)).toBe(false);
    }
  });

  it('a refusal that comes from the record itself (the PDF is missing) comes out the same way, and nothing is thrown', () => {
    for (const earlier of [null, EARLIER]) {
      const t = tree();
      if (earlier) writeFileSync(t.recordPath, earlier);
      rmSync(t.pdfPath);
      expectRefusal(run(t, [SOURCE_FILE]), `${t.pdfPath} is missing`);
      if (earlier) expect(readFileSync(t.recordPath)).toEqual(earlier);
      else expect(existsSync(t.recordPath)).toBe(false);
    }
  });
});

describe('the CLI (node scripts/record-guide-pdf.mjs)', () => {
  // The script beside this file, by its real path.
  const SCRIPT = realpathSync(fileURLToPath(new URL('../record-guide-pdf.mjs', import.meta.url)));
  /** `node <argv…>` with the tree's haiWeb directory as the working directory. HAICORE_DIR is the tree's haiCore, or is unset when `haicoreDir` is null. */
  function node(t: ReturnType<typeof tree>, argv: string[], haicoreDir: string | null = t.core) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.HAICORE_DIR;
    if (haicoreDir !== null) env.HAICORE_DIR = haicoreDir;
    return spawnSync(process.execPath, argv, { cwd: t.web, env, encoding: 'utf8' });
  }
  /** The record on disk, checked whole; its builtAt is the time of the run, which is returned. */
  function recordOnDisk(t: ReturnType<typeof tree>): string {
    const record = JSON.parse(readFileSync(t.recordPath, 'utf8'));
    expect(record).toEqual({
      bodySha256: bytesSha(PDF), edition: '1.104.0', sourceFile: SOURCE_FILE, sourceSha256: textSha(readFileSync(t.sourcePath, 'utf8')), builtAt: expect.any(String),
    });
    expect(new Date(record.builtAt).toISOString()).toBe(record.builtAt);
    return record.builtAt;
  }

  it('records with HAICORE_DIR set: exit 0, the one line on stdout, and the record on disk, stamped with the time of the run', () => {
    const t = tree();
    const before = Date.now();
    const r = node(t, [SCRIPT, SOURCE_FILE]);
    const after = Date.now();
    expect([r.status, r.stdout, r.stderr]).toEqual([0, `${recordedLine(t)}\n`, '']);
    const builtAt = Date.parse(recordOnDisk(t));
    expect(builtAt).toBeGreaterThanOrEqual(before);
    expect(builtAt).toBeLessThanOrEqual(after);
  });

  it('a run with no argument exits 1 with the reason, the refusal and the usage line on stderr, no stack trace, and no record', () => {
    const t = tree();
    const r = node(t, [SCRIPT]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(
      'record:guide-pdf takes exactly one argument, the guide source\'s bare file name, and 0 came.\n' +
        'Refused: nothing was written.\n' +
        'Usage: HAICORE_DIR=<haiCore checkout> npm run record:guide-pdf -- client-implementation-guidelines-v<version>.md\n',
    );
    expect(existsSync(t.recordPath)).toBe(false);
  });

  // With HAICORE_DIR unset the source is read from ../haiCore, beside the haiWeb directory the command runs in.
  it('reads the source from ../haiCore when HAICORE_DIR is unset', () => {
    const t = tree({ coreName: 'haiCore' });
    const r = node(t, [SCRIPT, SOURCE_FILE], null);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, `${recordedLine(t)}\n`, '']);
    recordOnDisk(t);
  });

  // The entry check must hold wherever the checkout is. A file URL writes a space as %20, so a check that compares
  // import.meta.url with a hand-built file://<argv[1]> is false in such a path: the command prints nothing, writes
  // nothing and exits 0. The directory is taken by its real path, so the space is the only thing this test adds.
  it('runs from a copy in a directory whose name holds a space', () => {
    const dir = realpathSync(tmp('record check out-'));
    expect(dir).toContain(' ');
    const copy = join(dir, 'record-guide-pdf.mjs');
    copyFileSync(SCRIPT, copy);
    const t = tree();
    const r = node(t, [copy, SOURCE_FILE]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, `${recordedLine(t)}\n`, '']);
    recordOnDisk(t);
  });

  // Started through a symlink, argv[1] is the link while import.meta.url is the file the link points to. Compared as
  // given the two never match, and the command would do nothing and exit 0.
  it('runs when it is started through a symlink to the script', () => {
    const link = join(realpathSync(tmp('record-link-')), 'record-guide-pdf.mjs');
    symlinkSync(SCRIPT, link);
    const t = tree();
    const r = node(t, [link, SOURCE_FILE]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, `${recordedLine(t)}\n`, '']);
    recordOnDisk(t);
  });

  // The tree is complete and the importing script is given a good argument, so a command that did start on import
  // would write the record and print its line.
  it('does nothing when another script imports it: the import gives the functions, and no record is written', () => {
    const t = tree();
    const importer = join(realpathSync(tmp('record-importer-')), 'importer.mjs');
    writeFileSync(importer, `const record = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\nconsole.log(typeof record.main);\n`);
    const r = node(t, [importer, SOURCE_FILE]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, 'function\n', '']);
    expect(existsSync(t.recordPath)).toBe(false);
  });

  // The entry check takes real paths, and a path that names no file has none. A process whose argv[1] is such a path
  // is importing the module: the import must not throw, and it must not start the command.
  it('stays importable, and does not run, in a process whose argv[1] names no file', () => {
    const t = tree();
    const code = `process.argv[1] = ${JSON.stringify(join(t.web, 'no-such-entry.mjs'))}; const record = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)}); console.log(typeof record.main);`;
    const r = node(t, ['--input-type=module', '-e', code, SOURCE_FILE]);
    expect([r.status, r.stdout, r.stderr]).toEqual([0, 'function\n', '']);
    expect(existsSync(t.recordPath)).toBe(false);
  });
});

describe('package.json', () => {
  it('has the script "record:guide-pdf": "node scripts/record-guide-pdf.mjs"', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
    expect(pkg.scripts['record:guide-pdf']).toBe('node scripts/record-guide-pdf.mjs');
  });
});
