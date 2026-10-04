// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  stripGuideForPack, parseKnownEnvVars, parseFrontMatter, latestBriefFile, collectDeployDocs, listZipEntries,
  newerAsBuiltWarning, assemblePack, main, DEPLOY_DOC_PATHS,
} from '../publish-help-pack.mjs';
import { sha256Hex as guideSha256Hex, verifySourceUnchanged } from '../build-guide-pdf.mjs';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const created: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); created.push(d); return d; };
afterEach(() => { created.forEach((d) => rmSync(d, { recursive: true, force: true })); created.length = 0; });
const write = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

describe('DEPLOY_DOC_PATHS', () => {
  it('is the six deployment files of spec §5.1, in the spec\'s order', () => {
    expect(DEPLOY_DOC_PATHS).toEqual(['.env.example', 'Dockerfile', '.dockerignore', 'scripts/docker-entrypoint.sh', 'README.md', 'UPGRADING.md']);
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
const BODY = '<section class="page" data-edition="1.7">TOC</section>';
const BRIEF = '---\nas_built: 9-22_as_built.md\ndate: 2026-10-07\nreviewed_by: Owner\n---\n# Brief\n';
const PAGES = '## /account/agents\n**Page:** x\n';

function trees(over: { body?: string; source?: string; brief?: string } = {}) {
  const web = tmp('web-');
  const core = tmp('core-');
  const zip = makeZip(DOCS);
  write(web, 'design/configuration-guide/body.html', over.body ?? BODY);
  write(web, 'design/help/console-pages.md', PAGES);
  write(web, 'private/agent-downloads/configuration-guide.json', JSON.stringify({
    bodySha256: sha(BODY), edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: sha(SOURCE), builtAt: '2026-10-07T11:00:00.000Z',
  }));
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
      guide: { edition: '1.7', source_file: 'client-implementation-guidelines-v1.7.md', source_sha256: sha(SOURCE), body_sha256: sha(BODY), pdf_built_at: '2026-10-07T11:00:00.000Z' },
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
  it('refuses when body.html is not the body the served PDF was built from', () => {
    const t = trees({ body: BODY + '<!-- edited after the render -->' });
    expect(() => assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })).toThrow(/not the body the served PDF was built from/);
  });
  it('refuses when the source markdown changed since the served PDF was built', () => {
    const t = trees({ source: SOURCE + 'amended\n' });
    expect(() => assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head })).toThrow(/changed since the served PDF was built/);
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
  it('gives a brief with no front matter an empty date, reviewed_by and as_built, which main then refuses', async () => {
    const t = trees({ brief: '# Brief\n' });
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head }).manifest.brief).toEqual({ file: 'SUPPORT-BRIEF-2026-10-07.md', date: '', reviewed_by: '', as_built: '' });
    await expect(main({ dryRun: true, haiwebDir: t.web, haicoreDir: t.core, env: {}, head, commitTime: () => 1, log: () => {}, warn: () => {} })).rejects.toThrow(/owner review/);
  });
  it('hashes the guide source as build:guide-pdf does: as UTF-8 text, never as raw bytes (CN-1)', async () => {
    const t = trees();
    const sourceFile = 'client-implementation-guidelines-v1.7.md';
    const path = join(t.core, 'docs', sourceFile);
    writeFileSync(path, Buffer.concat([Buffer.from('# Guide\n'), Buffer.from([0xff]), Buffer.from('\n## §1 Quick Start\nRun it.\n')]));
    const sourceSha256 = guideSha256Hex(readFileSync(path, 'utf8'));
    expect(sourceSha256).not.toBe(createHash('sha256').update(readFileSync(path)).digest('hex'));
    await expect(verifySourceUnchanged({ sourceFile, sourceSha256 }, join(t.core, 'docs'))).resolves.toBeUndefined();
    write(t.web, 'private/agent-downloads/configuration-guide.json', JSON.stringify({ bodySha256: sha(BODY), edition: '1.7', sourceFile, sourceSha256, builtAt: '2026-10-07T11:00:00.000Z' }));
    expect(assemblePack({ haiwebDir: t.web, haicoreDir: t.core, now: NOW, head }).manifest.guide.source_sha256).toBe(sourceSha256);
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
});

describe('the CLI (node scripts/publish-help-pack.mjs)', () => {
  // The script beside this file, by its real path: the CLI block runs only when import.meta.url is file://<argv[1]>.
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
    const r = cli(t, [], { nodeArgs: ['--import', pathToFileURL(preload).href], env: { HAICORE_URL: 'http://help-pack.invalid', HELP_PUBLISH_TOKEN: 'sekret-bearer-token' } });
    expect(r.stderr).toContain('Publish failed: HTTP 401');
    expect(r.status).toBe(1);
  });
});
