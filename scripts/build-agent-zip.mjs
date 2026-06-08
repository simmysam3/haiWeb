import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Build a secret-safe source archive of the haiClient agent via `git archive`
 * (tracked files only — .env*, data/, *.duckdb, node_modules are gitignored and
 * therefore excluded), and write a manifest describing it.
 *
 * NOTE: this excludes gitignored files only. A *tracked* secret (e.g. someone
 * `git add`ed a real .env or key) WOULD be archived — keep secrets gitignored.
 *
 * @param {{ repoPath: string, outDir: string, now?: Date }} opts
 * @returns {{ version: string, zipFile: string, zipBytes: number, builtAt: string }}
 */
export function buildAgentZip({ repoPath, outDir, now = new Date() }) {
  const repo = resolve(repoPath);
  if (!existsSync(join(repo, '.git'))) {
    throw new Error(`Not a git repository: ${repo}`);
  }

  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  const version = pkg.version;
  if (!version) {
    throw new Error(`No "version" in ${join(repo, 'package.json')}`);
  }

  mkdirSync(outDir, { recursive: true });
  const zipFile = `haiwave-agent-v${version}.zip`;
  const zipPath = join(outDir, zipFile);

  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', zipPath, 'HEAD'], { stdio: 'pipe' });

  const manifest = {
    version,
    zipFile,
    zipBytes: statSync(zipPath).size,
    builtAt: now.toISOString(),
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// CLI entrypoint: `node scripts/build-agent-zip.mjs`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const repoPath = process.env.AGENT_SOURCE_REPO ?? '../haiClient';
  const outDir = resolve('private/agent-downloads');
  const manifest = buildAgentZip({ repoPath, outDir });
  console.log(`Built ${manifest.zipFile} (${manifest.zipBytes} bytes) for agent v${manifest.version}`);
}
