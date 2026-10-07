// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, realpathSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HelpPackPayloadSchema } from '@haiwave/protocol';
import {
  stripGuideForPack, parseKnownEnvVars, parseFrontMatter, latestBriefFile, collectDeployDocs, listZipEntries,
  newerAsBuiltWarning, assemblePack, main, DEPLOY_DOC_PATHS,
} from '../publish-help-pack.mjs';
import { recordGuidePdf } from '../record-guide-pdf.mjs';
import { ALLOWLIST } from '../lib/agent-archive-allowlist.mjs';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const created: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); created.push(d); return d; };
afterEach(() => { created.forEach((d) => rmSync(d, { recursive: true, force: true })); created.length = 0; });
const write = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

describe('DEPLOY_DOC_PATHS', () => {
  it('is the six deployment files of spec §5.1, in the spec\'s order', () => {
    expect(DEPLOY_DOC_PATHS).toEqual(['.env.example', 'Dockerfile', '.dockerignore', 'scripts/docker-entrypoint.sh', 'README.md', 'UPGRADING.md']);
  });
  // The pack reads these six files from the served zip, and the zip is a `git archive` of the allowlist. An allowlist
  // that drops one of them still builds the archive; publish:help-pack then refuses ("the served agent zip lacks …")
  // at the runbook's last step, after the image that carries the zip is deployed.
  it('names only files the agent archive ships: every entry is on the archive allowlist', () => {
    expect(DEPLOY_DOC_PATHS.filter((p: string) => !ALLOWLIST.includes(p))).toEqual([]);
  });
});

describe('stripGuideForPack', () => {
  it('drops HTML comments and the Change log section, keeping every other section', () => {
    const md = '<!-- SOURCE OF RECORD … maintenance notes -->\n# Guide\n## §1 Quick Start\nRun it. <!-- haiClient:src/app.ts:1 -->\n## §A Appendix\nA.\n## Change log\n| 1.7 | … |\n';
    expect(stripGuideForPack(md)).toBe('# Guide\n## §1 Quick Start\nRun it. \n## §A Appendix\nA.\n');
  });
  it('keeps a section that follows the Change log', () => {
    expect(stripGuideForPack('## §1 A\na\n## Change log\nrow\n## §2 B\nb\n')).toBe('## §1 A\na\n## §2 B\nb\n');
  });
  it('removes a comment that spans several lines (the v1.7 maintenance header)', () => {
    expect(stripGuideForPack('<!--\n  SOURCE OF RECORD\n  maintenance notes\n-->\n# Guide\nbody\n')).toBe('# Guide\nbody\n');
  });
  it('drops a ### heading inside the Change log with the section', () => {
    expect(stripGuideForPack('## §1 A\na\n## Change log\n### 1.7\nrow\n### 1.6\nrow\n## §2 B\nb\n')).toBe('## §1 A\na\n## §2 B\nb\n');
  });
  it.each([
    ['a capital L', '## A\na\n## Change Log\nrow\n', '## A\na\n'],
    ['trailing spaces', '## A\na\n## Change log  \nrow\n', '## A\na\n'],
    ['CRLF line endings', '## A\r\na\r\n## Change log\r\nrow\r\n', '## A\r\na\n'],
  ])('strips a Change log heading written with %s', (_name, md, expected) => {
    expect(stripGuideForPack(md)).toBe(expected);
  });
  it('keeps a section whose heading only starts with "Change log"', () => {
    expect(stripGuideForPack('## A\na\n## Change log format\nkept\n')).toBe('## A\na\n## Change log format\nkept\n');
  });
  it('collapses the blank lines a removed comment leaves behind', () => {
    expect(stripGuideForPack('a\n\n<!-- c -->\n\nb\n')).toBe('a\n\nb\n');
  });
});

describe('parseKnownEnvVars', () => {
  it('reads set and commented assignments, sorted and unique, and ignores prose', () => {
    const env = 'PORT=3001\n# AGENT_PUBLIC_URL=https://agent.example.com\n#   ROUTER_MODE=llm\n# NOTE: the code reads HAICORE_BASE_URL — ignored here\nPORT=3002\n';
    expect(parseKnownEnvVars(env)).toEqual(['AGENT_PUBLIC_URL', 'PORT', 'ROUTER_MODE']);
  });
  it.each([
    ['an assignment quoted inside a comment sentence', '# Set ROUTER_MODE=llm to enable', []],
    ['a ## line', '## FOO=1', []],
    ['a lower-case name', 'lower=1', []],
    ['a second NAME= inside a value', 'URL=postgres://h/db?SSLMODE=require', ['URL']],
    ['a name with digits and an empty value', 'OAUTH2_CLIENT_ID=', ['OAUTH2_CLIENT_ID']],
  ])('%s gives only the names a line assigns at its start', (_name, line, names) => {
    expect(parseKnownEnvVars(`${line}\n`)).toEqual(names);
  });
});

describe('parseFrontMatter and latestBriefFile', () => {
  it('reads front matter, including an empty value, and returns null without one', () => {
    expect(parseFrontMatter('---\nas_built: 9-22_as_built.md\nreviewed_by:\n---\n# B\n')).toEqual({ as_built: '9-22_as_built.md', reviewed_by: '' });
    expect(parseFrontMatter('# B\n')).toBeNull();
  });
  it('picks the newest SUPPORT-BRIEF by date and refuses when there is none', () => {
    const dir = tmp('briefs-');
    for (const f of ['SUPPORT-BRIEF-2026-09-30.md', 'SUPPORT-BRIEF-2026-10-07.md', 'BRIEF-AUTHORING.md']) write(dir, f, 'x');
    expect(latestBriefFile(dir)).toBe('SUPPORT-BRIEF-2026-10-07.md');
    expect(() => latestBriefFile(tmp('nobriefs-'))).toThrow(/no SUPPORT-BRIEF/);
  });
  // The two cases below are VALID briefs (plan C.4): the three values must be what haiCore's parser reads, the literal trimmed text.
  it('reads a CRLF brief with padded values as the literal trimmed text of each key', () => {
    const brief = '---\r\nas_built: 9-22_as_built.md  \r\ndate:   2026-10-07 \r\nreviewed_by: "Test Owner" # approved: yes  \r\n---\r\n# Brief\r\n';
    expect(parseFrontMatter(brief)).toEqual({ as_built: '9-22_as_built.md', date: '2026-10-07', reviewed_by: '"Test Owner" # approved: yes' });
  });
  it('closes the block at the first --- line: key-like lines and a later rule in the body change nothing', () => {
    const brief = '---\nas_built: 9-22_as_built.md\ndate: 2026-10-07\nreviewed_by: Test Owner\n---\n# Brief\n\nreviewed_by: Body\ndate: 1999-01-01\n\n---\n\nreviewed_by: After the rule\n';
    expect(parseFrontMatter(brief)).toEqual({ as_built: '9-22_as_built.md', date: '2026-10-07', reviewed_by: 'Test Owner' });
  });
  it('takes only a file named exactly SUPPORT-BRIEF-YYYY-MM-DD.md', () => {
    const dir = tmp('briefs-');
    const others = ['SUPPORT-BRIEF-TEMPLATE.md', 'SUPPORT-BRIEF-2026-10-09-draft.md', 'SUPPORT-BRIEF-2026-10-07.md.bak', 'zz-SUPPORT-BRIEF-2026-12-01.md', 'zz-notes.md'];
    for (const f of ['SUPPORT-BRIEF-2026-10-07.md', ...others]) write(dir, f, 'x');
    expect(latestBriefFile(dir)).toBe('SUPPORT-BRIEF-2026-10-07.md');
  });
  it('refuses a brief directory that does not exist with the same message', () => {
    expect(() => latestBriefFile(join(tmp('nobriefdir-'), 'docs', 'help'))).toThrow(/no SUPPORT-BRIEF/);
  });
});

function makeZip(files: Record<string, string>): string {
  const repo = tmp('helppack-zip-repo-');
  const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
  git('init', '-q'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 'T');
  for (const [p, c] of Object.entries(files)) write(repo, p, c);
  git('add', '-A'); git('commit', '-qm', 'init');
  const out = join(tmp('helppack-zip-out-'), 'haiwave-agent-v1.102.0.zip');
  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', out, 'HEAD']);
  return out;
}
/** A zip whose entries keep the order given (stored, not deflated). `git archive` always writes its entries sorted, so makeZip cannot show the sort. */
function storeZip(files: Array<[string, string]>): string {
  const crc32 = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const n = Buffer.from(name);
    const data = Buffer.from(text);
    const sizes = Buffer.alloc(12); sizes.writeUInt32LE(crc32(data), 0); sizes.writeUInt32LE(data.length, 4); sizes.writeUInt32LE(data.length, 8);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); sizes.copy(header, 14); header.writeUInt16LE(n.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); sizes.copy(entry, 16); entry.writeUInt16LE(n.length, 28); entry.writeUInt32LE(offset, 42);
    local.push(header, n, data);
    central.push(entry, n);
    offset += header.length + n.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const out = join(tmp('helppack-zip-out-'), 'haiwave-agent-v1.102.0.zip');
  writeFileSync(out, Buffer.concat([...local, directory, end]));
  return out;
}
const DOCS: Record<string, string> = {
  '.env.example': 'PORT=3001\n# AGENT_PUBLIC_URL=https://agent.example.com\n',
  'Dockerfile': 'FROM node:22-slim AS builder\n',
  '.dockerignore': 'scripts\n!scripts/docker-entrypoint.sh\n',
  'scripts/docker-entrypoint.sh': '#!/bin/sh\nexec "$@"\n',
  'README.md': '# Agent\n',
  'UPGRADING.md': '# Upgrading\n',
};

describe('collectDeployDocs', () => {
  it('reads the six fixed files and any docs/*.md the zip carries, in that order', () => {
    const zip = makeZip({ ...DOCS, 'docs/erp-connector.md': '# ERP\n', 'src/app.ts': 'x' });
    expect(collectDeployDocs(zip).map((d: { path: string }) => d.path)).toEqual([...DEPLOY_DOC_PATHS, 'docs/erp-connector.md']);
    expect(collectDeployDocs(zip)[0]).toEqual({ path: '.env.example', content: DOCS['.env.example'] });
  });
  it('refuses a zip that lacks a fixed file', () => {
    const { ['UPGRADING.md']: _dropped, ...rest } = DOCS;
    expect(() => collectDeployDocs(makeZip(rest))).toThrow(/lacks UPGRADING\.md/);
  });
  it('returns every file with its own content, non-ASCII text included', () => {
    const files: Record<string, string> = { ...DOCS, 'README.md': '# Agent — naïve café ✓\n', 'docs/erp-connector.md': '# ERP — coût\n' };
    expect(collectDeployDocs(makeZip(files))).toEqual([...DEPLOY_DOC_PATHS, 'docs/erp-connector.md'].map((path) => ({ path, content: files[path] })));
  });
  it('takes only the .md files directly under docs/', () => {
    const zip = makeZip({ ...DOCS, 'docs/erp-connector.md': '# ERP\n', 'docs/sub/nested.md': 'n', 'src/docs/inner.md': 'i', 'docs/diagram.txt': 't', 'docs/notes.md.bak': 'k' });
    expect(collectDeployDocs(zip).map((d: { path: string }) => d.path)).toEqual([...DEPLOY_DOC_PATHS, 'docs/erp-connector.md']);
  });
  it('returns the docs sorted by path, whatever order the zip lists them in', () => {
    const zip = storeZip([...Object.entries(DOCS), ['docs/b.md', 'B\n'], ['docs/a.md', 'A\n']]);
    expect(listZipEntries(zip).slice(-2)).toEqual(['docs/b.md', 'docs/a.md']);
    expect(collectDeployDocs(zip).slice(DEPLOY_DOC_PATHS.length)).toEqual([{ path: 'docs/a.md', content: 'A\n' }, { path: 'docs/b.md', content: 'B\n' }]);
  });
  it('reads a 2 MiB doc whole', () => {
    const big = '0123456789abcde\n'.repeat(131072);
    const doc = collectDeployDocs(makeZip({ ...DOCS, 'docs/big.md': big })).at(-1)!;
    expect(doc.path).toBe('docs/big.md');
    expect(doc.content.length).toBe(2 * 1024 * 1024);
    expect(doc.content === big).toBe(true);
  });
  it('reads a doc whose name holds an unzip wildcard character as that file, never as a pattern', () => {
    // In path order. A name with two wildcard characters sits beside the file an escape of only the first would read.
    const wild: Record<string, string> = {
      'docs/a*.md': 'STAR\n', 'docs/a*b*.md': 'TWO-STARS\n', 'docs/a*bZZ.md': 'STAR-ZZ\n', 'docs/abc.md': 'ABC\n',
      'docs/b\\c.md': 'BACKSLASH\n', 'docs/bc.md': 'BC\n',
      'docs/faq[v2].md': 'REAL\n', 'docs/faqv.md': 'OTHER\n',
      'docs/q?[a].md': 'MIXED\n', 'docs/q?a.md': 'MIXED-OTHER\n',
      'docs/what?.md': 'Q\n', 'docs/whats.md': 'S\n',
      'docs/x[1]2.md': 'BRACKET-OTHER\n', 'docs/x[1][2].md': 'TWO-BRACKETS\n',
    };
    const docs = collectDeployDocs(makeZip({ ...DOCS, ...wild })).slice(DEPLOY_DOC_PATHS.length);
    expect(docs).toEqual(Object.entries(wild).map(([path, content]) => ({ path, content })));
  });
});

/** `git init` on first use, then commit everything in `dir` at `date`; returns the new HEAD. */
function commitAll(dir: string, date = '2026-10-07T00:00:00Z'): string {
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe', env }).toString().trim();
  if (!existsSync(join(dir, '.git'))) { git('init', '-q'); git('config', 'user.email', 't@t.t'); git('config', 'user.name', 'T'); }
  git('add', '-A'); git('commit', '-qm', 'fixture');
  return git('rev-parse', 'HEAD');
}

describe('newerAsBuiltWarning', () => {
  it('names as-built editions committed after the brief\'s, and is null otherwise', () => {
    const core = tmp('core-asbuilt-');
    for (const f of ['9-09_as_built.md', '9-22_as_built.md', '10-14_as_built.md']) write(core, `docs/${f}`, 'x');
    const times: Record<string, number> = { 'docs/9-09_as_built.md': 1, 'docs/9-22_as_built.md': 2, 'docs/10-14_as_built.md': 3 };
    const commitTime = (_repo: string, path: string) => times[path] ?? 0;
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '9-22_as_built.md', commitTime })).toMatch(/10-14_as_built\.md/);
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '10-14_as_built.md', commitTime })).toBeNull();
  });
  it('does not name an edition committed at the same time as the brief\'s', () => {
    const core = tmp('core-asbuilt-');
    for (const f of ['9-22_as_built.md', '10-14_as_built.md']) write(core, `docs/${f}`, 'x');
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '9-22_as_built.md', commitTime: () => 2 })).toBeNull();
  });
  it('names only N-N_as_built.md editions, never another docs file committed later', () => {
    const core = tmp('core-asbuilt-');
    for (const f of ['9-22_as_built.md', '11-02_as_built.md', 'README.md', '10-14_as_built_notes.md', 'draft-10-14_as_built.md']) write(core, `docs/${f}`, 'x');
    const commitTime = (_repo: string, path: string) => (path === 'docs/9-22_as_built.md' ? 1 : 9);
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '9-22_as_built.md', commitTime })).toMatch(/the brief's 9-22_as_built\.md: 11-02_as_built\.md —/);
  });
  it('reads the commit times from git when no commitTime is passed', () => {
    const core = tmp('core-git-');
    write(core, 'docs/9-22_as_built.md', 'x');
    commitAll(core, '2026-09-22T00:00:00Z');
    write(core, 'docs/10-14_as_built.md', 'x');
    commitAll(core, '2026-10-14T00:00:00Z');
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '9-22_as_built.md' })).toMatch(/the brief's 9-22_as_built\.md: 10-14_as_built\.md —/);
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '10-14_as_built.md' })).toBeNull();
  });
});

const SOURCE = '<!-- header -->\n# Guide\n## §1 Quick Start\nRun it.\n## Change log\nrow\n';
/** A stand-in for the served PDF: it begins with %PDF- and holds bytes that are not valid UTF-8, so the hash of its text is not the hash of its bytes. */
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from([0xff, 0xfe, 0x00]), Buffer.from('\n%%EOF\n')]);
const PDF_FILE = 'private/agent-downloads/configuration-guide.pdf';
/** What record:guide-pdf writes as bodySha256: the hash of the PDF's raw bytes. */
const PDF_SHA = createHash('sha256').update(PDF).digest('hex');
const BRIEF = '---\nas_built: 9-22_as_built.md\ndate: 2026-10-07\nreviewed_by: Owner\n---\n# Brief\n';
const PAGES = '## /account/agents\n**Page:** x\n';

function trees(over: { source?: string; brief?: string } = {}) {
  const web = tmp('web-');
  const core = tmp('core-');
  const zip = makeZip(DOCS);
  write(web, 'design/help/console-pages.md', PAGES);
  write(web, 'private/agent-downloads/configuration-guide.json', JSON.stringify({
    bodySha256: PDF_SHA, edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE), builtAt: '2026-10-07T11:00:00.000Z',
  }));
  writeFileSync(join(web, PDF_FILE), PDF);
  write(web, 'private/agent-downloads/manifest.json', JSON.stringify({ version: '1.102.0', zipFile: 'haiwave-agent-v1.102.0.zip', zipBytes: 1, builtAt: 'x' }));
  writeFileSync(join(web, 'private/agent-downloads/haiwave-agent-v1.102.0.zip'), readFileSync(zip));
  write(core, 'docs/client-implementation-guidelines-v1.7.md', over.source ?? SOURCE);
  write(core, 'docs/help/SUPPORT-BRIEF-2026-10-07.md', over.brief ?? BRIEF);
  write(core, 'docs/9-22_as_built.md', 'x');
  write(core, 'packages/protocol/package.json', JSON.stringify({ version: '3.98.0' }));
  return { web, core };
}
const head = (repo: string) => (repo.includes('web-') ? 'abcdef1234' : '1234567abc');
const NOW = new Date('2026-10-07T11:30:00.000Z');

describe('assemblePack', () => {
  it('builds the C.2 payload from the served artifacts and the haiCore docs', () => {
    const t = trees();
    const p = assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    expect(p.schema_version).toBe(1);
    expect(p.manifest).toEqual({
      guide: { edition: '1.7', source_file: 'client-implementation-guidelines-v1.7.md', source_sha256: sha(SOURCE), body_sha256: PDF_SHA, pdf_built_at: '2026-10-07T11:00:00.000Z' },
      agent: { version: '1.102.0', zip_file: 'haiwave-agent-v1.102.0.zip' },
      brief: { file: 'SUPPORT-BRIEF-2026-10-07.md', date: '2026-10-07', reviewed_by: 'Owner', as_built: '9-22_as_built.md' },
      console_pages_sha256: sha(PAGES),
      built_at: NOW.toISOString(),
      built_from: { haiweb_commit: 'abcdef1234', haicore_commit: '1234567abc' },
    });
    expect(p.parts.guide).toBe('# Guide\n## §1 Quick Start\nRun it.\n');
    expect(p.parts.deploy_docs.map((d: { path: string }) => d.path)).toEqual(DEPLOY_DOC_PATHS);
    expect(p.parts.console_pages).toBe(PAGES);
    expect(p.parts.brief).toBe(BRIEF);
    expect(p.known_env_vars).toEqual(['AGENT_PUBLIC_URL', 'PORT']);
  });
  // One byte differs, and it is one of the bytes that are not valid UTF-8: read as text the two files are the same.
  it('refuses when the served PDF is not the PDF that was recorded', () => {
    const t = trees();
    const changed = Buffer.from(PDF);
    changed[changed.indexOf(0xff)] = 0xfd;
    expect(changed.toString('utf8')).toBe(PDF.toString('utf8'));
    writeFileSync(join(t.web, PDF_FILE), changed);
    let message = 'assembled';
    try {
      assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toBe(
      'assemblePack: private/agent-downloads/configuration-guide.pdf is not the PDF that was recorded ' +
        '(configuration-guide.json bodySha256 differs). Render it again, which records it too: ' +
        'npm run render:guide-pdf -- <guide source file>, then publish. A PDF that was placed by hand is recorded with ' +
        'npm run record:guide-pdf -- <guide source file>.',
    );
  });
  // The stand-in PDF of the other tests is a few bytes, and the served one is megabytes. This one is built in memory,
  // and its record holds the hash of every byte of it.
  it('checks a PDF larger than 64 KiB whole: the recorded one assembles, and a change in its last byte alone refuses', () => {
    const t = trees();
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(200 * 1024, 0xa5), Buffer.from([0x01])]);
    const bigSha = createHash('sha256').update(big).digest('hex');
    writeFileSync(join(t.web, PDF_FILE), big);
    write(t.web, 'private/agent-downloads/configuration-guide.json', JSON.stringify({
      bodySha256: bigSha, edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE), builtAt: '2026-10-07T11:00:00.000Z',
    }));
    const assemble = () => assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    expect(assemble().manifest.guide.body_sha256).toBe(bigSha);

    const other = Buffer.from(big);
    other[other.length - 1] = 0x02;
    writeFileSync(join(t.web, PDF_FILE), other);
    expect(assemble).toThrow(
      'assemblePack: private/agent-downloads/configuration-guide.pdf is not the PDF that was recorded ' +
        '(configuration-guide.json bodySha256 differs). Render it again, which records it too: ' +
        'npm run render:guide-pdf -- <guide source file>, then publish. A PDF that was placed by hand is recorded with ' +
        'npm run record:guide-pdf -- <guide source file>.',
    );
  });
  it.each([
    ['the served PDF', 'configuration-guide.pdf'],
    ['the record', 'configuration-guide.json'],
  ])('refuses when %s is missing, and the error names the file', (_name, file) => {
    const t = trees();
    rmSync(join(t.web, 'private/agent-downloads', file));
    expect(() => assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })).toThrow(join(t.web, 'private/agent-downloads', file));
  });
  // The body of the retired haiWeb render plays no part: the fixture tree has no design/configuration-guide/ at all.
  it('never reads design/configuration-guide/body.html: it assembles without one, and to the same payload when one is there', () => {
    const t = trees();
    expect(existsSync(join(t.web, 'design/configuration-guide'))).toBe(false);
    const without = assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    write(t.web, 'design/configuration-guide/body.html', '<section class="page" data-edition="9.9">any text</section>');
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })).toEqual(without);
  });
  // The remedy is a new render, which records the PDF too: the record command alone would record the old PDF
  // against the new source.
  it('refuses when the guide source is not the source that was recorded, and names the render command as the remedy', () => {
    const t = trees({ source: SOURCE + 'amended\n' });
    let message = 'assembled';
    try {
      assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toBe(
      'assemblePack: client-implementation-guidelines-v1.7.md is not the source that was recorded ' +
        '(configuration-guide.json sourceSha256 differs). Check HAICORE_DIR. If the guide changed, the served PDF must be ' +
        'rendered again from it, which records it too: npm run render:guide-pdf -- <guide source file>, then publish.',
    );
  });
  it('stamps built_from with each tree\'s git HEAD when no head is passed', () => {
    const t = trees();
    const heads = { haiweb_commit: commitAll(t.web), haicore_commit: commitAll(t.core) };
    expect(heads.haiweb_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(heads.haicore_commit).not.toBe(heads.haiweb_commit);
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW }).manifest.built_from).toEqual(heads);
  });
  it('reads the zip by its base name in agent-downloads, whatever directory manifest.json names', () => {
    const t = trees();
    write(t.web, 'private/agent-downloads/manifest.json', JSON.stringify({ version: '1.102.0', zipFile: '../../elsewhere/haiwave-agent-v1.102.0.zip', zipBytes: 1, builtAt: 'x' }));
    const p = assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    expect(p.manifest.agent).toEqual({ version: '1.102.0', zip_file: 'haiwave-agent-v1.102.0.zip' });
    expect(p.parts.deploy_docs.map((d: { path: string }) => d.path)).toEqual(DEPLOY_DOC_PATHS);
  });
  it('has exactly the keys of HelpPackPayload (plan C.2: the server schema is strict)', () => {
    const t = trees();
    const p = assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    expect(Object.keys(p).sort()).toEqual(['known_env_vars', 'manifest', 'parts', 'schema_version']);
    expect(Object.keys(p.parts).sort()).toEqual(['brief', 'console_pages', 'deploy_docs', 'guide']);
  });
  // The test above compares the key names with contract C.2 by hand (phase 1 could not import the protocol in haiWeb).
  // This one hands the same payload to the schema haiCore's PUT /admin/help/packs validates with.
  it('parses under the protocol\'s HelpPackPayloadSchema, which is strict (plan C.2)', () => {
    const t = trees();
    const p = assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });
    expect(() => HelpPackPayloadSchema.parse(p)).not.toThrow();
  });
  it('gives a brief with no front matter an empty date, reviewed_by and as_built, which main then refuses', async () => {
    const t = trees({ brief: '# Brief\n' });
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head }).manifest.brief).toEqual({ file: 'SUPPORT-BRIEF-2026-10-07.md', date: '', reviewed_by: '', as_built: '' });
    await expect(main({ dryRun: true, haiwebDir: t.web, haicoreDir: t.core, env: {}, head, commitTime: () => 1, log: () => {}, warn: () => {} })).rejects.toThrow(/owner review/);
  });
  it('hashes the guide source as UTF-8 text, never as raw bytes (CN-1)', () => {
    const t = trees();
    const sourceFile = 'client-implementation-guidelines-v1.7.md';
    const path = join(t.core, 'docs', sourceFile);
    writeFileSync(path, Buffer.concat([Buffer.from('# Guide\n'), Buffer.from([0xff]), Buffer.from('\n## §1 Quick Start\nRun it.\n')]));
    const sourceSha256 = sha(readFileSync(path, 'utf8'));
    expect(sourceSha256).not.toBe(createHash('sha256').update(readFileSync(path)).digest('hex'));
    write(t.web, 'private/agent-downloads/configuration-guide.json', JSON.stringify({ bodySha256: PDF_SHA, edition: '1.7', sourceFile, sourceSha256, builtAt: '2026-10-07T11:00:00.000Z' }));
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head }).manifest.guide.source_sha256).toBe(sourceSha256);
  });
});

// The two commands share no code: each hashes the PDF's bytes and the source's text on its own. This test holds them together.
describe('record:guide-pdf, then assemblePack', () => {
  it('assembles what was recorded, refuses the PDF once a byte of it changes, and assembles again once it is recorded again', () => {
    const t = trees();
    const downloads = join(t.web, 'private/agent-downloads');
    const sourceFile = 'client-implementation-guidelines-v1.7.md';
    const sourcePath = join(t.core, 'docs', sourceFile);
    // The source holds a byte that is not valid UTF-8, so the two commands agree on it only if both hash its text.
    writeFileSync(sourcePath, Buffer.concat([Buffer.from('# Guide\n'), Buffer.from([0xff]), Buffer.from('\n## §1 Quick Start\nRun it.\n')]));
    rmSync(join(downloads, 'configuration-guide.json'));
    const pdfShaOnDisk = () => createHash('sha256').update(readFileSync(join(t.web, PDF_FILE))).digest('hex');
    const record = (now: Date) => recordGuidePdf({ downloadsDir: downloads, haicoreDocsDir: join(t.core, 'docs'), sourceFile, now });
    const assemble = () => assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head });

    const recordedAt = new Date('2026-10-07T11:15:00.000Z');
    record(recordedAt);
    const first = assemble();
    expect(first.manifest.guide).toEqual({
      edition: '1.7', source_file: sourceFile, source_sha256: sha(readFileSync(sourcePath, 'utf8')), body_sha256: pdfShaOnDisk(), pdf_built_at: recordedAt.toISOString(),
    });
    expect(first.manifest.guide.body_sha256).toBe(PDF_SHA);
    expect(() => HelpPackPayloadSchema.parse(first)).not.toThrow();

    // One byte changes, and as text the file is the same as before.
    const changed = Buffer.from(PDF);
    changed[changed.indexOf(0xff)] = 0xfd;
    writeFileSync(join(t.web, PDF_FILE), changed);
    expect(assemble).toThrow(/is not the PDF that was recorded/);

    const recordedAgainAt = new Date('2026-10-08T09:30:00.000Z');
    record(recordedAgainAt);
    const second = assemble();
    expect(second.manifest.guide).toEqual({ ...first.manifest.guide, body_sha256: pdfShaOnDisk(), pdf_built_at: recordedAgainAt.toISOString() });
    expect(second.manifest.guide.body_sha256).not.toBe(first.manifest.guide.body_sha256);
  });
});

/** main stamps its own built_at, so two payloads are compared without it. */
function withoutBuiltAt(payload: { manifest: Record<string, unknown> }) {
  const manifest = { ...payload.manifest };
  delete manifest.built_at;
  return { ...payload, manifest };
}

describe('main', () => {
  const quiet = { log: () => {}, warn: () => {} };
  const commitTime = () => 1;

  it('--dry-run writes private/help-pack/help-pack.preview.json and calls nothing', async () => {
    const t = trees();
    const calls: unknown[] = [];
    const code = await main({ dryRun: true, haiwebDir: t.web, haicoreDir: t.core, env: {}, fetchImpl: async (...a: unknown[]) => { calls.push(a); throw new Error('no'); }, head, commitTime, ...quiet });
    expect(code).toBe(0);
    expect(calls).toEqual([]);
    const preview = JSON.parse(readFileSync(join(t.web, 'private/help-pack/help-pack.preview.json'), 'utf8'));
    expect(preview.manifest.brief.file).toBe('SUPPORT-BRIEF-2026-10-07.md');
  });

  it('publishes with PUT, the admin bearer and the protocol header; 201 → exit 0', async () => {
    const t = trees();
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return { status: 201, text: async () => JSON.stringify({ pack_id: '11111111-1111-4111-8111-111111111111', version: '2026-10-07.1' }) };
    };
    const code = await main({ dryRun: false, haiwebDir: t.web, haicoreDir: t.core, env: { HAICORE_URL: 'http://localhost:3000/', HELP_PUBLISH_TOKEN: 'tok' }, fetchImpl, head, commitTime, ...quiet });
    expect(code).toBe(0);
    expect(seen[0]!.url).toBe('http://localhost:3000/api/v1/admin/help/packs');
    expect(seen[0]!.init.method).toBe('PUT');
    expect(seen[0]!.init.headers).toMatchObject({ authorization: 'Bearer tok', 'x-haiwave-protocol-version': '3.98.0', 'content-type': 'application/json' });
    expect(JSON.parse(String(seen[0]!.init.body)).schema_version).toBe(1);
  });

  it('prints the server\'s violations on 422 and exits 1', async () => {
    const t = trees();
    const out: string[] = [];
    const fetchImpl = async () => ({ status: 422, text: async () => JSON.stringify({ error: { code: 'HELP_PACK_INVALID', details: { violations: [{ rule: 'register_id', match: 'D-235', line: 9 }] } } }) });
    const code = await main({ dryRun: false, haiwebDir: t.web, haicoreDir: t.core, env: { HAICORE_URL: 'http://x', HELP_PUBLISH_TOKEN: 't' }, fetchImpl, head, commitTime, log: () => {}, warn: (m: string) => out.push(m) });
    expect(code).toBe(1);
    expect(out.join('\n')).toContain('[register_id] D-235 (brief line 9)');
  });

  it('refuses before any request when the brief has no reviewed_by', async () => {
    const t = trees({ brief: BRIEF.replace('reviewed_by: Owner', 'reviewed_by:') });
    await expect(main({ dryRun: true, haiwebDir: t.web, haicoreDir: t.core, env: {}, head, commitTime, ...quiet })).rejects.toThrow(/owner review/);
    expect(existsSync(join(t.web, 'private/help-pack/help-pack.preview.json'))).toBe(false);
  });

  const ENV = { HAICORE_URL: 'http://help-pack.invalid', HELP_PUBLISH_TOKEN: 'sekret-bearer-token' };
  const PACK = { pack_id: '11111111-1111-4111-8111-111111111111', version: '2026-10-07.1' };
  /** main against a fake fetch that answers `res`, recording every call and every log and warn line. */
  function publisher(res: { status: number; text: string } = { status: 201, text: JSON.stringify(PACK) }) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const logs: string[] = [];
    const warns: string[] = [];
    const fetchImpl = async (url: string, init: RequestInit) => { calls.push({ url, init }); return { status: res.status, text: async () => res.text }; };
    const run = (t: { web: string; core: string }, over: { dryRun?: boolean; env?: Record<string, string | undefined>; commitTime?: (repo: string, path: string) => number } = {}) =>
      main({ dryRun: false, haiwebDir: t.web, haicoreDir: t.core, env: ENV, fetchImpl, head, commitTime, log: (m: string) => logs.push(m), warn: (m: string) => warns.push(m), ...over });
    return { calls, logs, warns, run };
  }

  it('sends the protocol version it reads from haiCore\'s packages/protocol/package.json', async () => {
    const t = trees();
    write(t.core, 'packages/protocol/package.json', JSON.stringify({ name: '@haiwave/protocol', version: '3.99.7' }));
    const p = publisher();
    expect(await p.run(t)).toBe(0);
    expect(p.calls[0]!.init.headers).toMatchObject({ 'x-haiwave-protocol-version': '3.99.7' });
  });

  it('sends the whole assembled payload as the PUT body', async () => {
    const t = trees();
    const p = publisher();
    expect(await p.run(t)).toBe(0);
    expect(p.calls).toHaveLength(1);
    const sent = JSON.parse(String(p.calls[0]!.init.body));
    expect(withoutBuiltAt(sent)).toEqual(withoutBuiltAt(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })));
    expect(new Date(sent.manifest.built_at).toISOString()).toBe(sent.manifest.built_at);
  });

  it('--dry-run writes the whole assembled payload as the preview', async () => {
    const t = trees();
    expect(await publisher().run(t, { dryRun: true, env: {} })).toBe(0);
    const preview = JSON.parse(readFileSync(join(t.web, 'private/help-pack/help-pack.preview.json'), 'utf8'));
    expect(withoutBuiltAt(preview)).toEqual(withoutBuiltAt(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })));
  });

  it('--dry-run logs the preview file it wrote', async () => {
    const t = trees();
    const p = publisher();
    await p.run(t, { dryRun: true, env: {} });
    expect(p.logs).toHaveLength(1);
    expect(p.logs[0]).toContain(join(t.web, 'private', 'help-pack', 'help-pack.preview.json'));
  });

  it('401 with a JSON body → exit 1, and the failure names the status and the body', async () => {
    const p = publisher({ status: 401, text: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }) });
    expect(await p.run(trees())).toBe(1);
    expect(p.warns.join('\n')).toContain('HTTP 401');
    expect(p.warns.join('\n')).toContain('UNAUTHORIZED');
  });

  it('502 with an HTML body → exit 1, and the failure shows the raw text', async () => {
    const p = publisher({ status: 502, text: '<html>Bad Gateway</html>' });
    expect(await p.run(trees())).toBe(1);
    expect(p.warns.join('\n')).toContain('HTTP 502');
    expect(p.warns.join('\n')).toContain('<html>Bad Gateway</html>');
  });

  it('200 is not a publish: only 201 is', async () => {
    const p = publisher({ status: 200, text: JSON.stringify(PACK) });
    expect(await p.run(trees())).toBe(1);
    expect(p.logs).toEqual([]);
    expect(p.warns.join('\n')).toContain('HTTP 200');
  });

  it('refuses an unreviewed brief on the publish path too, before any request', async () => {
    const p = publisher();
    await expect(p.run(trees({ brief: BRIEF.replace('reviewed_by: Owner', 'reviewed_by:') }))).rejects.toThrow(/owner review/);
    expect(p.calls).toEqual([]);
  });

  it.each([
    ['HELP_PUBLISH_TOKEN', { HAICORE_URL: ENV.HAICORE_URL }],
    ['HAICORE_URL', { HELP_PUBLISH_TOKEN: ENV.HELP_PUBLISH_TOKEN }],
  ])('refuses to publish without %s, before any request', async (_name, env) => {
    const p = publisher();
    await expect(p.run(trees(), { env })).rejects.toThrow(/HAICORE_URL and HELP_PUBLISH_TOKEN/);
    expect(p.calls).toEqual([]);
  });

  it('warns about a newer as-built edition and still publishes', async () => {
    const t = trees();
    write(t.core, 'docs/10-14_as_built.md', 'x');
    const p = publisher();
    expect(await p.run(t, { commitTime: (_repo: string, path: string) => (path === 'docs/10-14_as_built.md' ? 2 : 1) })).toBe(0);
    expect(p.warns).toHaveLength(1);
    expect(p.warns[0]).toMatch(/the brief's 9-22_as_built\.md: 10-14_as_built\.md —/);
    expect(p.calls).toHaveLength(1);
  });

  it('prints a violation that has no line without a "(brief line …)" suffix', async () => {
    const violations = [{ rule: 'manifest_mismatch', match: 'brief.date', line: null }];
    const p = publisher({ status: 422, text: JSON.stringify({ error: { code: 'HELP_PACK_INVALID', details: { violations } } }) });
    expect(await p.run(trees())).toBe(1);
    expect(p.warns.join('\n')).toContain('[manifest_mismatch] brief.date');
    expect(p.warns.join('\n')).not.toContain('(brief line');
  });

  it('a 422 that carries no violation list still exits 1', async () => {
    const p = publisher({ status: 422, text: JSON.stringify({ error: { code: 'HELP_PACK_INVALID' } }) });
    expect(await p.run(trees())).toBe(1);
    expect(p.warns.join('\n')).toContain('422 HELP_PACK_INVALID');
  });

  it.each([
    [201, JSON.stringify(PACK)],
    [401, JSON.stringify({ error: { code: 'UNAUTHORIZED' } })],
    [422, JSON.stringify({ error: { code: 'HELP_PACK_INVALID', details: { violations: [{ rule: 'ipv4', match: '10.0.0.1', line: 12 }] } } })],
  ])('never prints the bearer token: HTTP %i', async (status, text) => {
    const p = publisher({ status, text });
    await p.run(trees());
    expect(p.calls[0]!.init.headers).toMatchObject({ authorization: `Bearer ${ENV.HELP_PUBLISH_TOKEN}` });
    expect([...p.logs, ...p.warns]).toHaveLength(1);
    expect([...p.logs, ...p.warns].join('\n')).not.toContain(ENV.HELP_PUBLISH_TOKEN);
  });

  it('strips every trailing slash from HAICORE_URL', async () => {
    const p = publisher();
    await p.run(trees(), { env: { ...ENV, HAICORE_URL: `${ENV.HAICORE_URL}//` } });
    expect(p.calls[0]!.url).toBe('http://help-pack.invalid/api/v1/admin/help/packs');
  });

  it('201 logs the pack version and id', async () => {
    const p = publisher();
    await p.run(trees());
    expect(p.logs).toHaveLength(1);
    expect(p.logs[0]).toContain(PACK.version);
    expect(p.logs[0]).toContain(PACK.pack_id);
  });

  it('stamps built_at with the time of the run, in the PUT body and in the dry-run preview', async () => {
    const t = trees();
    const p = publisher();
    const before = Date.now();
    expect(await p.run(t)).toBe(0);
    expect(await p.run(t, { dryRun: true, env: {} })).toBe(0);
    const after = Date.now();
    const sent = JSON.parse(String(p.calls[0]!.init.body));
    const preview = JSON.parse(readFileSync(join(t.web, 'private/help-pack/help-pack.preview.json'), 'utf8'));
    for (const builtAt of [sent.manifest.built_at, preview.manifest.built_at]) {
      expect(Date.parse(builtAt)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(builtAt)).toBeLessThanOrEqual(after);
    }
  });
});

describe('the CLI (node scripts/publish-help-pack.mjs)', () => {
  // The script beside this file. Its CLI block runs when argv[1] and the module are one file by their real paths
  // (isEntryPoint): the tests at the end start a copy from a directory with a space, and the script through a link.
  const SCRIPT = realpathSync(fileURLToPath(new URL('../publish-help-pack.mjs', import.meta.url)));
  const PREVIEW = 'private/help-pack/help-pack.preview.json';
  /** Both trees as git repositories (the CLI reads the real HEADs and commit times), with each HEAD. */
  function gitTrees(over: { brief?: string } = {}) {
    const t = trees(over);
    return { ...t, heads: { haiweb_commit: commitAll(t.web), haicore_commit: commitAll(t.core) } };
  }
  /** Runs the script in the temp haiWeb tree. The parent's HAICORE_URL and HELP_PUBLISH_TOKEN never reach the child. */
  function cli(t: { web: string; core: string }, args: string[], extra: { nodeArgs?: string[]; env?: Record<string, string> } = {}) {
    const env: NodeJS.ProcessEnv = { ...process.env, HAICORE_DIR: t.core };
    delete env.HAICORE_URL;
    delete env.HELP_PUBLISH_TOKEN;
    delete env.npm_config_dry_run;
    return spawnSync(process.execPath, [...(extra.nodeArgs ?? []), SCRIPT, ...args], { cwd: t.web, env: { ...env, ...extra.env }, encoding: 'utf8' });
  }

  it('--dry-run exits 0 and writes the preview, stamped with each tree\'s git HEAD', () => {
    const t = gitTrees();
    const r = cli(t, ['--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Dry run: wrote');
    expect(JSON.parse(readFileSync(join(t.web, PREVIEW), 'utf8')).manifest.built_from).toEqual(t.heads);
  });

  it('--dry-run on an unreviewed brief exits 1 with the reason on stderr and writes no preview', () => {
    const t = gitTrees({ brief: BRIEF.replace('reviewed_by: Owner', 'reviewed_by:') });
    const r = cli(t, ['--dry-run']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('owner review is required before publishing');
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  it('exits with main\'s code when the publish fails (a preloaded fake fetch answers 401: nothing is sent)', () => {
    const t = gitTrees();
    const preload = join(tmp('helppack-preload-'), 'fake-fetch.mjs');
    writeFileSync(preload, 'globalThis.fetch = async () => ({ status: 401, text: async () => \'{"error":{"code":"UNAUTHORIZED"}}\' });\n');
    const r = cli(t, ['--publish'], { nodeArgs: ['--import', pathToFileURL(preload).href], env: { HAICORE_URL: 'http://help-pack.invalid', HELP_PUBLISH_TOKEN: 'sekret-bearer-token' } });
    expect(r.stderr).toContain('Publish failed: HTTP 401');
    expect(r.status).toBe(1);
  });

  it('--dry-run warns on stderr about an as-built edition committed after the brief\'s, by the trees\' real commit times', () => {
    const t = gitTrees();
    write(t.core, 'docs/10-14_as_built.md', 'x');
    commitAll(t.core, '2026-10-14T00:00:00Z');
    const r = cli(t, ['--dry-run']);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/the brief's 9-22_as_built\.md: 10-14_as_built\.md —/);
  });

  const FAKE_ENV = { HAICORE_URL: 'http://help-pack.invalid', HELP_PUBLISH_TOKEN: 'sekret-bearer-token' };
  const UNREVIEWED = BRIEF.replace('reviewed_by: Owner', 'reviewed_by:');
  /**
   * A fake `fetch` to preload into the child, with fake values for the two variables: the child can send nothing.
   * The fake prints nothing. It appends one line per call to a file that the preload itself creates and never
   * empties, so `requests()` is what the fake saw in every child that loaded it, and it throws when none did. Like
   * the real fetch, it throws on a header value that cannot be sent. `answer` is the statement that ends the fake:
   * by default it returns a 201.
   */
  function fakeFetch(answer = 'return { status: 201, text: async () => \'{"pack_id":"11111111-1111-4111-8111-111111111111","version":"2026-10-07.1"}\' };') {
    const dir = tmp('helppack-preload-');
    const seen = join(dir, 'requests.txt');
    writeFileSync(join(dir, 'fake-fetch.mjs'), [
      "import { appendFileSync } from 'node:fs';",
      `const seen = ${JSON.stringify(seen)};`,
      "appendFileSync(seen, '');",
      'globalThis.fetch = async (url, init) => {',
      '  appendFileSync(seen, `${init.method} ${url}\\n`);',
      '  new Headers(init.headers);',
      `  ${answer}`,
      '};',
      '',
    ].join('\n'));
    return {
      nodeArgs: ['--import', pathToFileURL(join(dir, 'fake-fetch.mjs')).href],
      env: FAKE_ENV,
      requests: () => readFileSync(seen, 'utf8').split('\n').filter(Boolean),
    };
  }
  /** `node <argv…>` in the temp haiWeb tree with a fake fetch preloaded: for a copy of the script, a link to it, or code that imports it. */
  function node(t: { web: string; core: string }, fake: ReturnType<typeof fakeFetch>, argv: string[]) {
    const env: NodeJS.ProcessEnv = { ...process.env, HAICORE_DIR: t.core, ...fake.env };
    delete env.npm_config_dry_run;
    return spawnSync(process.execPath, [...fake.nodeArgs, ...argv], { cwd: t.web, env, encoding: 'utf8' });
  }
  /** All of stderr when the arguments are refused: the reason, that nothing was done, and the two forms the command takes. */
  const refused = (reason: string) =>
    `publish:help-pack: ${reason}. Refused: nothing was assembled or sent.\n` +
    'For a dry run: npm run publish:help-pack -- --dry-run\n' +
    'To publish:    npm run publish:help-pack -- --publish\n';

  // The entry check must hold wherever the checkout is. A file URL encodes a space, `#`, `%` and every non-ASCII
  // character, so a check that compares import.meta.url with a hand-built `file://<argv[1]>` is false in such a path:
  // the command prints nothing, sends nothing and exits 0. The directory is taken by its real path (macOS reaches the
  // temp directory through the /var link), so the space is the only thing this test adds.
  it('runs from a copy in a directory whose name holds a space', () => {
    const dir = realpathSync(tmp('helppack check out-'));
    expect(dir).toContain(' ');
    const copy = join(dir, 'publish-help-pack.mjs');
    copyFileSync(SCRIPT, copy);
    const fake = fakeFetch();
    const refused = node(gitTrees({ brief: UNREVIEWED }), fake, [copy, '--dry-run']);
    expect([refused.status, refused.stdout]).toEqual([1, '']);
    expect(refused.stderr).toContain('owner review is required before publishing');
    const reviewed = gitTrees();
    const ran = node(reviewed, fake, [copy, '--dry-run']);
    expect(ran.status).toBe(0);
    expect(ran.stdout).toContain('Dry run: wrote');
    expect(existsSync(join(reviewed.web, PREVIEW))).toBe(true);
    expect(fake.requests()).toEqual([]);
  });

  // The same for the other characters a file URL writes differently from the path: `#` becomes `%23`, `%` becomes
  // `%25`, and a non-ASCII character becomes the escapes of its UTF-8 bytes. A check that undoes only the space's
  // `%20` is still false in all three directories, and one that runs decodeURI over the URL is still false in the
  // first (decodeURI leaves `%23` as it is). The brief is unreviewed, so only a run gives exit 1.
  it.each([
    ['a hash', 'helppack-my#web-', /#/],
    ['a percent sign', 'helppack-my%20web-', /%20/],
    ['a non-ASCII character', 'helppack-caféweb-', /[\u0080-￿]/],
  ])('runs from a copy in a directory whose name holds %s', (_name, prefix, held) => {
    const dir = realpathSync(tmp(prefix));
    expect(dir).toMatch(held);
    const copy = join(dir, 'publish-help-pack.mjs');
    copyFileSync(SCRIPT, copy);
    const fake = fakeFetch();
    const r = node(gitTrees({ brief: UNREVIEWED }), fake, [copy, '--dry-run']);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('owner review is required before publishing');
    expect(fake.requests()).toEqual([]);
  });

  // Started through a symlink, argv[1] is the link while import.meta.url is the file the link points to. Compared as
  // given the two never match. The brief is unreviewed, so only a run gives exit 1.
  it('runs when it is started through a symlink to the script', () => {
    const link = join(realpathSync(tmp('helppack-link-')), 'publish-help-pack.mjs');
    symlinkSync(SCRIPT, link);
    const fake = fakeFetch();
    const r = node(gitTrees({ brief: UNREVIEWED }), fake, [link, '--dry-run']);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('owner review is required before publishing');
    expect(fake.requests()).toEqual([]);
  });

  // The entry check takes real paths, and a path that names no file has none (ENOENT). A process whose argv[1] is such
  // a path is importing the module: the import must not throw, and it must not start the command. The brief here is
  // unreviewed, so a command that did start would exit 1 with the refusal, before any request.
  it('stays importable, and does not run, in a process whose argv[1] names no file', () => {
    const t = gitTrees({ brief: UNREVIEWED });
    const fake = fakeFetch();
    const code = `process.argv[1] = ${JSON.stringify(join(t.web, 'no-such-entry.mjs'))}; const help = await import(${JSON.stringify(pathToFileURL(SCRIPT).href)}); console.log(typeof help.main);`;
    const r = node(t, fake, ['--input-type=module', '-e', code]);
    expect([r.status, r.stdout]).toEqual([0, 'function\n']);
    expect(fake.requests()).toEqual([]);
  });

  // A publish is asked for with `--publish`. Both variables are set (fake values), and the fake answers 201.
  it('--publish publishes: exit 0, one PUT to /api/v1/admin/help/packs, and "Published help pack" on stdout', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, ['--publish'], fake);
    expect(fake.requests()).toEqual(['PUT http://help-pack.invalid/api/v1/admin/help/packs']);
    expect(r.stdout).toContain('Published help pack 2026-10-07.1');
    expect(r.status).toBe(0);
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // A run with no argument used to publish. Both variables are set and the tree is ready, so a run that is not
  // refused sends the pack.
  const NO_ARGUMENT = 'no argument came: the command takes one, --dry-run or --publish, after npm\'s "--" separator (npm keeps a flag typed before it for itself)';
  it('refuses a run with no argument before any request: it says why, shows the two forms, and writes no preview', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, [], fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused(NO_ARGUMENT));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // `npm run publish:help-pack --publish`, typed without npm's `--` separator: npm keeps the flag for itself, passes no
  // argument and sets npm_config_publish=true. The command never reads that variable: this is a run with no argument.
  it('refuses when no argument came and npm_config_publish is set: npm kept the flag, and nothing is sent', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, [], { nodeArgs: fake.nodeArgs, env: { ...fake.env, npm_config_publish: 'true' } });
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused(NO_ARGUMENT));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // The same variable beside an argument that did arrive changes nothing: `--dry-run` is a dry run.
  it('--dry-run is a dry run even when npm_config_publish is set: the preview, and no request', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, ['--dry-run'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, npm_config_publish: 'true' } });
    expect(fake.requests()).toEqual([]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Dry run: wrote');
    expect(existsSync(join(t.web, PREVIEW))).toBe(true);
  });

  // Only `--dry-run` and `--publish` are arguments. Any other one used to take the LIVE path, and a successful publish
  // activates the pack. Both variables are set here (fake values), so a command that is not refused sends one PUT to
  // the fake.
  it.each(['--dryrun', '-n', '--dry-run=true'])('refuses the argument %s before any request, naming it and the dry-run command', (arg) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, [arg], fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain(`unknown argument ${JSON.stringify(arg)}`);
    expect(r.stderr).toContain('npm run publish:help-pack -- --dry-run');
    expect(r.stderr).not.toMatch(/published/i);
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // The refusal looks at every argument, whatever its shape and wherever it stands. npm passes an empty string and a
  // bare word through as they are; an unknown argument can come with a second one, or after `--dry-run`. None of these
  // may publish, and the last must not run as a dry run either. The message names the first unknown argument.
  it.each([
    ['an empty string', [''], ''],
    ['a bare word', ['dry-run'], 'dry-run'],
    ['two unknown arguments', ['-n', '--dryrun'], '-n'],
    ['an unknown argument after --dry-run', ['--dry-run', '-n'], '-n'],
  ])('refuses %s before any request, and writes no preview', (_name, args, named) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, args, fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain(`unknown argument ${JSON.stringify(named)}`);
    expect(r.stderr).not.toMatch(/published/i);
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // A bare `--` beside `--publish` is an argument like any other, and an unknown one: two arguments came, so nothing
  // runs. The command never drops it as a separator, which would leave `--publish` as the one argument and publish.
  // Both variables are set (fake values), so a command that is not refused sends one PUT to the fake.
  it.each([
    ['in front of --publish', ['--', '--publish']],
    ['after --publish', ['--publish', '--']],
  ])('refuses a bare "--" %s: an unknown argument, never a separator to drop, so no request and no preview', (_name, args) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, args, fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused('unknown argument "--": the one argument is --dry-run or --publish'));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // The argument that publishes is `--publish`, exactly as written. A misspelt or foreign form of it is an unknown
  // argument, however close it comes: refused before any request, with the argument named as it was typed.
  it.each([
    ['--publsh'],
    ['--Publish'],
    ['-p'],
    ['publish'],
    ['--publish=true'],
    ['--publish '],
    ['-publish'],
  ])('refuses %j, which is not --publish, before any request: it names the argument and shows the two forms', (arg) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, [arg], fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused(`unknown argument ${JSON.stringify(arg)}: the one argument is --dry-run or --publish`));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // The command takes exactly one argument. `--dry-run` and `--publish` together ask for opposite things, and an
  // argument typed twice is not one argument either. None of these runs, as a dry run or as a publish.
  it.each([
    ['--dry-run, then --publish', ['--dry-run', '--publish']],
    ['--publish, then --dry-run', ['--publish', '--dry-run']],
    ['--publish twice', ['--publish', '--publish']],
    ['--dry-run twice', ['--dry-run', '--dry-run']],
    ['--publish three times', ['--publish', '--publish', '--publish']],
  ])('refuses more than one argument (%s) before any request, and writes no preview', (_name, args) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, args, fake);
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused(`more than one argument came (${args.join(' ')}): the command takes exactly one, --dry-run or --publish`));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // `npm run publish:help-pack --dry-run`, typed without npm's `--` separator: npm keeps the flag for itself, passes no
  // argument and sets npm_config_dry_run=true, and the command used to publish. It is refused, not run as a silent dry
  // run: exit 0 means "published" or "the dry run wrote its preview", never "did nothing".
  it.each([
    ['true, as npm sets it', 'true'],
    ['empty: the variable being there is enough', ''],
  ])('refuses when no argument came and npm_config_dry_run is set (%s), naming the dry-run command', (_name, value) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, [], { nodeArgs: fake.nodeArgs, env: { ...fake.env, npm_config_dry_run: value } });
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('npm_config_dry_run is set');
    expect(r.stderr).toContain('npm keeps a --dry-run');
    expect(r.stderr).toContain('npm run publish:help-pack -- --dry-run');
    expect(r.stderr).not.toMatch(/published/i);
    expect(r.stderr).toBe(refused('no argument came and npm_config_dry_run is set: npm keeps a --dry-run typed before its "--" separator for itself'));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // `npm run publish:help-pack --dry-run -- --publish`: npm keeps the first flag and sets npm_config_dry_run, and the
  // command receives `--publish`. The two ask for opposite things, so nothing runs: no publish, and no dry run either.
  it.each([
    ['true, as npm sets it', 'true'],
    ['empty: the variable being there is enough', ''],
  ])('refuses --publish while npm_config_dry_run is set (%s) before any request, and writes no preview', (_name, value) => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, ['--publish'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, npm_config_dry_run: value } });
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused('--publish came while npm_config_dry_run is set (npm keeps a --dry-run typed before its "--" separator for itself): the two ask for opposite things'));
    expect(existsSync(join(t.web, PREVIEW))).toBe(false);
  });

  // The arguments are refused before the command reads anything. Here there is nothing to read: the directory is empty
  // and HAICORE_DIR names nothing, so a command that assembled first would stop on a missing file instead.
  it.each([
    ['a run with no argument', [] as string[], {} as Record<string, string>, NO_ARGUMENT],
    ['a misspelt argument', ['--publsh'], {}, 'unknown argument "--publsh": the one argument is --dry-run or --publish'],
    ['two arguments', ['--dry-run', '--publish'], {}, 'more than one argument came (--dry-run --publish): the command takes exactly one, --dry-run or --publish'],
    [
      '--publish while npm_config_dry_run is set', ['--publish'], { npm_config_dry_run: 'true' },
      '--publish came while npm_config_dry_run is set (npm keeps a --dry-run typed before its "--" separator for itself): the two ask for opposite things',
    ],
  ])('refuses %s before it reads anything: in an empty directory the refusal is the same, and the directory stays empty', (_name, args, env, reason) => {
    const dir = tmp('helppack-no-tree-');
    const fake = fakeFetch();
    const r = cli({ web: dir, core: join(dir, 'no-haicore') }, args, { nodeArgs: fake.nodeArgs, env: { ...fake.env, ...env } });
    expect(fake.requests()).toEqual([]);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toBe(refused(reason));
    expect(readdirSync(dir)).toEqual([]);
  });

  // With `--dry-run` among the arguments the command did receive it: a dry run, whatever npm's variable says.
  it('--dry-run is a dry run even when npm_config_dry_run is set: the preview, and no request', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, ['--dry-run'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, npm_config_dry_run: 'true' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Dry run: wrote');
    expect(existsSync(join(t.web, PREVIEW))).toBe(true);
    expect(fake.requests()).toEqual([]);
  });

  // The token travels in a header. With a line break in it the real fetch throws `Headers.append: "Bearer <token>" is
  // an invalid header value`, and the command printed that message: the whole token, on stderr. A token that is not
  // one line of visible ASCII is refused before any request, by a message that holds no part of it.
  it.each([
    ['a line break', 'sekret-bearer\ntoken-tail'],
    ['a space', 'sekret-bearer token-tail'],
    ['a non-ASCII character', 'sekret-bearer\u00e9token-tail'],
    ['a control character', 'sekret-bearer\x7ftoken-tail'],
  ])('refuses a HELP_PUBLISH_TOKEN that holds %s before any request, and prints no part of it', (_name, token) => {
    const fake = fakeFetch();
    const r = cli(gitTrees(), ['--publish'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, HELP_PUBLISH_TOKEN: token } });
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('HELP_PUBLISH_TOKEN');
    for (const part of ['sekret-bearer', 'token-tail']) expect(r.stderr).not.toContain(part);
    expect(fake.requests()).toEqual([]);
  });

  // The check refuses only what a header cannot carry. Every visible ASCII character can be in a token, not only
  // letters, digits, `.`, `_` and `-`: base64 has `+`, `/` and `=`, and `!` and `~` are the two ends of the range.
  it('accepts a HELP_PUBLISH_TOKEN that holds visible ASCII punctuation: one request, and the pack is published', () => {
    const fake = fakeFetch();
    const r = cli(gitTrees(), ['--publish'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, HELP_PUBLISH_TOKEN: 'eyJhbGciOi.abc+def/ghi=~!' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Published help pack');
    expect(fake.requests()).toHaveLength(1);
  });

  // The token is checked on the publish path only, where it is used. A dry run sends nothing, so a token that could
  // not be sent does not stop it.
  it('--dry-run is still a dry run with a malformed HELP_PUBLISH_TOKEN in the environment: the preview, and no request', () => {
    const t = gitTrees();
    const fake = fakeFetch();
    const r = cli(t, ['--dry-run'], { nodeArgs: fake.nodeArgs, env: { ...fake.env, HELP_PUBLISH_TOKEN: 'sekret-bearer\ntoken-tail' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Dry run: wrote');
    expect(existsSync(join(t.web, PREVIEW))).toBe(true);
    expect(fake.requests()).toEqual([]);
  });

  // When Central cannot be reached, fetch rejects with `fetch failed` and nothing more: the reason is in the error's
  // `cause`. Here the cause has a message of its own (a host that does not resolve; a refused connection to a host
  // with one address). The command prints both messages.
  it('prints the cause of a request that failed, beside the error', () => {
    const fake = fakeFetch("throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND help-pack.invalid') });");
    const r = cli(gitTrees(), ['--publish'], fake);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('fetch failed');
    expect(r.stderr).toContain('getaddrinfo ENOTFOUND help-pack.invalid');
    expect(r.stderr).not.toContain(FAKE_ENV.HELP_PUBLISH_TOKEN);
    expect(fake.requests()).toHaveLength(1);
  });

  // The cause does not always have a message of its own. For a host with more than one address (`localhost` is ::1
  // and 127.0.0.1) with nothing listening, it is an AggregateError whose message is empty: the reason is in the
  // messages of its `errors`, and in its `code`. The command prints the inner messages, or the code when there are
  // none. Before, it printed only `fetch failed` for both.
  it.each([
    [
      'the inner errors of an AggregateError (a host with two addresses, nothing listening)',
      "Object.assign(new AggregateError([new Error('connect ECONNREFUSED ::1:3000'), new Error('connect ECONNREFUSED 127.0.0.1:3000')], ''), { code: 'ECONNREFUSED' })",
      ['connect ECONNREFUSED ::1:3000', 'connect ECONNREFUSED 127.0.0.1:3000'],
    ],
    ['its code, when it has no inner errors either', "Object.assign(new Error(''), { code: 'ECONNREFUSED' })", ['ECONNREFUSED']],
  ])('prints why a request failed when the cause has no message of its own: %s', (_name, cause, reasons) => {
    const fake = fakeFetch(`throw new TypeError('fetch failed', { cause: ${cause} });`);
    const r = cli(gitTrees(), ['--publish'], fake);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('fetch failed');
    expect(r.stderr).toContain('ECONNREFUSED');
    for (const reason of reasons) expect(r.stderr).toContain(reason);
    expect(r.stderr).not.toContain(FAKE_ENV.HELP_PUBLISH_TOKEN);
    expect(fake.requests()).toHaveLength(1);
  });

  // A refusal that is not a failed request has no cause. The command prints its message and nothing after it: every
  // other check of stderr in this file looks for a part of the text, so none would see a suffix.
  it('prints a refusal that has no cause as its message alone, with nothing after it', () => {
    const fake = fakeFetch();
    const r = cli(gitTrees({ brief: UNREVIEWED }), ['--publish'], fake);
    expect([r.status, r.stdout]).toEqual([1, '']);
    expect(r.stderr).toContain('owner review is required before publishing');
    expect(r.stderr).toMatch(/\(spec §5\.3\)\n$/);
    expect(r.stderr).not.toContain('undefined');
    expect(fake.requests()).toEqual([]);
  });
});
