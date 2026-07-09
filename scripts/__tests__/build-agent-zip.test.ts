// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAgentZip } from '../build-agent-zip.mjs';

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

    const manifest = buildAgentZip({ repoPath: repo, outDir: out, now: new Date('2026-06-08T00:00:00Z') });

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
    expect(() => buildAgentZip({ repoPath: repo, outDir: out })).toThrow(/Agent archive leak/);
  });

  it('succeeds and reports no leak for a clean repo', () => {
    const repo = initRepo();
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out })).not.toThrow();
  });
});
