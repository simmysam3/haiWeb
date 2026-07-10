// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAgentZip, assertConformanceShipped } from '../build-agent-zip.mjs';
import { ALLOWLIST } from '../lib/agent-archive-allowlist.mjs';

const created: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  created.push(d);
  return d;
}
afterEach(() => {
  created.forEach((d) => rmSync(d, { recursive: true, force: true }));
  created.length = 0;
});

function initRepo(pkg: Record<string, unknown> = { name: 'agent', version: '9.9.9' }): string {
  const dir = tmp('agentzip-repo-');
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  writeFileSync(join(dir, 'index.ts'), 'export const x = 1;\n');
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  writeFileSync(join(dir, '.env'), 'SECRET=shh\n'); // gitignored → must be excluded
  git('add', '-A');
  git('commit', '-qm', 'init');
  return dir;
}

describe('buildAgentZip', () => {
  it('archives tracked files, excludes gitignored secrets, writes manifest', () => {
    const repo = initRepo();
    const out = tmp('agentzip-out-');

    const manifest = buildAgentZip({ repoPath: repo, outDir: out, now: new Date('2026-06-08T00:00:00Z'), allowlist: ['.'] });

    expect(manifest.version).toBe('9.9.9');
    expect(manifest.zipFile).toBe('haiwave-agent-v9.9.9.zip');
    expect(manifest.builtAt).toBe('2026-06-08T00:00:00.000Z');
    expect(existsSync(join(out, 'haiwave-agent-v9.9.9.zip'))).toBe(true);

    const onDisk = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(onDisk).toEqual(manifest);

    const entries = execFileSync('unzip', ['-Z1', join(out, manifest.zipFile)]).toString();
    expect(entries).toContain('index.ts');
    expect(entries).toContain('package.json');
    expect(entries.split('\n')).not.toContain('.env');
  });

  it('throws on a non-git path', () => {
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: out, outDir: out })).toThrow(/git repository/);
  });

  it('throws when package.json has no version', () => {
    const repo = initRepo({ name: 'agent' }); // no version field
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out })).toThrow(/version/);
  });

  it('throws when the archive contains a demo company fingerprint', () => {
    const repo = initRepo();
    const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
    // Plant a tracked file that names a demo company.
    writeFileSync(join(repo, 'leak.ts'), '// example from an Amphenol search\n');
    git('add', '-A');
    git('commit', '-qm', 'plant');
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] })).toThrow(/Agent archive leak/);
  });

  it('deletes the leaked zip and writes no manifest when a fingerprint is found', () => {
    const repo = initRepo();
    const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
    // Plant a tracked file that names a demo company.
    writeFileSync(join(repo, 'leak.ts'), '// example from an Amphenol search\n');
    git('add', '-A');
    git('commit', '-qm', 'plant');
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] })).toThrow(/Agent archive leak/);
    expect(existsSync(join(out, 'haiwave-agent-v9.9.9.zip'))).toBe(false);
    expect(existsSync(join(out, 'manifest.json'))).toBe(false);
  });

  it('succeeds and reports no leak for a clean repo', () => {
    const repo = initRepo();
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] })).not.toThrow();
  });

  it('throws when a tracked filename names a demo company, even with clean content', () => {
    const repo = initRepo();
    const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
    // Plant a tracked file whose NAME carries the fingerprint but whose
    // CONTENT is unrelated/clean — the content scan alone would miss this.
    writeFileSync(join(repo, 'amphenol-config.json'), '{"port":3000}\n');
    git('add', '-A');
    git('commit', '-qm', 'plant filename-only fingerprint');
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] })).toThrow(/Agent archive leak/);
  });
});

function initStructuredRepo(): string {
  const dir = tmp('agentzip-struct-');
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  const write = (rel: string, content: string) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  };
  // package.json needs a version for buildAgentZip
  write('package.json', JSON.stringify({ name: 'agent', version: '9.9.9' }));
  // allowlisted paths (should ship)
  write('src/index.ts', 'export const x = 1;\n');
  write('packages/client-sdk/src/__tests__/conformance/jwt-auth.test.ts', '// conformance\n');
  write('haicore-protocol/dist/index.js', 'exports.x = 1;\n');
  write('Dockerfile', 'FROM node:22\n');
  write('scripts/docker-entrypoint.sh', '#!/bin/sh\n');
  write('scripts/seed-config.mjs', '// seed\n');
  write('scripts/hash-chat-password.mjs', '// hash\n');
  // remaining ALLOWLIST top-level entries: `git archive` is fail-loud — every
  // pathspec passed to it must match something, so the default-allowlist call
  // in this test needs a stub for every ALLOWLIST entry, not just the ones
  // under assertion below.
  write('frontend/index.ts', '// frontend stub\n');
  write('public/index.html', '<!-- public stub -->\n');
  write('config/default.json', '{}\n');
  write('package-lock.json', '{}\n');
  write('tsconfig.json', '{}\n');
  write('tsconfig.typecheck.json', '{}\n');
  write('vitest.config.ts', 'export default {};\n');
  write('docker-compose.yml', 'services: {}\n');
  write('.dockerignore', 'node_modules\n');
  write('README.md', '# agent\n');
  write('UPGRADING.md', '# upgrading\n');
  write('CHANGELOG.md', '# changelog\n');
  write('LICENSE', 'MIT\n');
  write('.env.example', 'SECRET=\n');
  write('.gitignore', 'node_modules\n');
  // internal paths (should NOT ship)
  write('CLAUDE.md', '# internal\n');
  write('.gitattributes',
    'tests/** export-ignore\n' +
    '**/__tests__/** export-ignore\n' +
    '**/*.test.ts export-ignore\n' +
    '**/*.spec.ts export-ignore\n' +
    'packages/client-sdk/src/__tests__/conformance -export-ignore\n' +
    'packages/client-sdk/src/__tests__/conformance/** -export-ignore\n');
  write('kill-agents.ps1', '# kill\n');
  write('deploy-agent.sh', '#!/bin/sh\n');
  write('docs/typed-memory.md', '# doc\n');
  write('scripts/sync-protocol.mjs', '// internal\n');
  write('src/chat/__tests__/query-router.test.ts', '// non-conformance test\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  return dir;
}

describe('agent archive allowlist invariants', () => {
  it('ships required entries and excludes internal ones under the default allowlist', () => {
    const repo = initStructuredRepo();
    const out = tmp('agentzip-out-');
    const manifest = buildAgentZip({ repoPath: repo, outDir: out }); // default ALLOWLIST
    const entries = execFileSync('unzip', ['-Z1', join(out, manifest.zipFile)]).toString();

    // present (required)
    for (const p of [
      'src/index.ts',
      'packages/client-sdk/src/__tests__/conformance/jwt-auth.test.ts',
      'haicore-protocol/dist/index.js',
      'Dockerfile',
      'scripts/docker-entrypoint.sh',
      'scripts/seed-config.mjs',
      'scripts/hash-chat-password.mjs',
      'package.json',
    ]) {
      expect(entries, `expected ${p} to ship`).toContain(p);
    }

    // absent (internal / non-conformance)
    for (const p of [
      'CLAUDE.md',
      '.gitattributes',
      'kill-agents.ps1',
      'deploy-agent.sh',
      'docs/typed-memory.md',
      'scripts/sync-protocol.mjs',
      'src/chat/__tests__/query-router.test.ts',
    ]) {
      expect(entries.split('\n'), `expected ${p} to be excluded`).not.toContain(p);
    }
  });

  it('the allowlist has no obviously-internal entries', () => {
    for (const p of ALLOWLIST) {
      expect(p).not.toMatch(/^(CLAUDE\.md|deploy-agent\.sh|kill-|docs\/|\.gitattributes)/);
    }
  });
});

function initRepoWithConformanceKit(opts: { kitFiles?: number; strayTest?: boolean } = {}): string {
  const { kitFiles = 12, strayTest = false } = opts;
  const dir = tmp('agentzip-conf-');
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  const write = (rel: string, content: string) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  };
  write('package.json', JSON.stringify({ name: 'agent', version: '9.9.9' }));
  for (let i = 0; i < kitFiles; i++) {
    write(`packages/client-sdk/src/__tests__/conformance/kit-${i}.test.ts`, `// conformance ${i}\n`);
  }
  if (strayTest) {
    write('src/foo.test.ts', '// stray non-conformance test\n');
  }
  git('add', '-A');
  git('commit', '-qm', 'init');
  return dir;
}

describe('assertConformanceShipped', () => {
  it('does not throw when the archive ships >= minKitFiles conformance tests and no other tests', () => {
    const repo = initRepoWithConformanceKit({ kitFiles: 12 });
    const out = tmp('agentzip-out-');
    const manifest = buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] });
    expect(() => assertConformanceShipped(join(out, manifest.zipFile))).not.toThrow();
  });

  it('throws "Conformance kit missing" when the archive ships no conformance files', () => {
    const repo = initRepoWithConformanceKit({ kitFiles: 0 });
    const out = tmp('agentzip-out-');
    const manifest = buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] });
    expect(() => assertConformanceShipped(join(out, manifest.zipFile))).toThrow(/Conformance kit missing/);
  });

  it('throws "Non-conformance test" when a stray test file ships alongside the kit', () => {
    const repo = initRepoWithConformanceKit({ kitFiles: 12, strayTest: true });
    const out = tmp('agentzip-out-');
    const manifest = buildAgentZip({ repoPath: repo, outDir: out, allowlist: ['.'] });
    expect(() => assertConformanceShipped(join(out, manifest.zipFile))).toThrow(/Non-conformance test/);
  });
});
