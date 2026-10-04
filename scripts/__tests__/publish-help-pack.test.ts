// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  stripGuideForPack, parseKnownEnvVars, parseFrontMatter, latestBriefFile, collectDeployDocs,
  newerAsBuiltWarning, assemblePack, main, DEPLOY_DOC_PATHS,
} from '../publish-help-pack.mjs';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const created: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); created.push(d); return d; };
afterEach(() => { created.forEach((d) => rmSync(d, { recursive: true, force: true })); created.length = 0; });
const write = (root: string, rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

describe('stripGuideForPack', () => {
  it('drops HTML comments and the Change log section, keeping every other section', () => {
    const md = '<!-- SOURCE OF RECORD … maintenance notes -->\n# Guide\n## §1 Quick Start\nRun it. <!-- haiClient:src/app.ts:1 -->\n## §A Appendix\nA.\n## Change log\n| 1.7 | … |\n';
    expect(stripGuideForPack(md)).toBe('# Guide\n## §1 Quick Start\nRun it. \n## §A Appendix\nA.\n');
  });
  it('keeps a section that follows the Change log', () => {
    expect(stripGuideForPack('## §1 A\na\n## Change log\nrow\n## §2 B\nb\n')).toBe('## §1 A\na\n## §2 B\nb\n');
  });
});

describe('parseKnownEnvVars', () => {
  it('reads set and commented assignments, sorted and unique, and ignores prose', () => {
    const env = 'PORT=3001\n# AGENT_PUBLIC_URL=https://agent.example.com\n#   ROUTER_MODE=llm\n# NOTE: the code reads HAICORE_BASE_URL — ignored here\nPORT=3002\n';
    expect(parseKnownEnvVars(env)).toEqual(['AGENT_PUBLIC_URL', 'PORT', 'ROUTER_MODE']);
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
});

describe('newerAsBuiltWarning', () => {
  it('names as-built editions committed after the brief\'s, and is null otherwise', () => {
    const core = tmp('core-asbuilt-');
    for (const f of ['9-09_as_built.md', '9-22_as_built.md', '10-14_as_built.md']) write(core, `docs/${f}`, 'x');
    const times: Record<string, number> = { 'docs/9-09_as_built.md': 1, 'docs/9-22_as_built.md': 2, 'docs/10-14_as_built.md': 3 };
    const commitTime = (_repo: string, path: string) => times[path] ?? 0;
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '9-22_as_built.md', commitTime })).toMatch(/10-14_as_built\.md/);
    expect(newerAsBuiltWarning({ haicoreDir: core, briefAsBuilt: '10-14_as_built.md', commitTime })).toBeNull();
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
});

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
});
