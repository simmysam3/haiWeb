import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DENYLIST } from './lib/agent-archive-denylist.mjs';
import { ALLOWLIST } from './lib/agent-archive-allowlist.mjs';

/**
 * Build a secret-safe source archive of the haiClient agent via `git archive`
 * (tracked files only — .env*, data/, *.duckdb, node_modules are gitignored and
 * therefore excluded), and write a manifest describing it.
 *
 * NOTE: this excludes gitignored files only. A *tracked* secret (e.g. someone
 * `git add`ed a real .env or key) WOULD be archived — keep secrets gitignored.
 */

/**
 * Scan a produced zip for denylisted fingerprints, checking both each
 * entry's path and its text content (streamed via `unzip -p`). Returns
 * every (file, matched-term) hit.
 */
export function scanZipForDenylist(zipPath) {
  const listing = execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
  const hits = [];
  for (const entry of listing) {
    for (const re of DENYLIST) {
      if (re.test(entry)) hits.push({ file: entry, term: `<path> ${entry.match(re)[0]}` });
    }
    if (entry.endsWith('/')) continue;
    let text;
    try {
      text = execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 64 * 1024 * 1024 }).toString();
    } catch {
      continue; // entry that failed extraction (corrupt/encrypted) — skip
    }
    for (const re of DENYLIST) {
      const m = text.match(re);
      if (m) hits.push({ file: entry, term: m[0] });
    }
  }
  return hits;
}

/**
 * Assert the produced archive ships the protocol conformance kit and no other
 * tests. Guards the subtle .gitattributes un-ignore rules: a dir-prune pattern
 * silently ships zero conformance files, which the denylist guard won't catch.
 */
export function assertConformanceShipped(zipPath, { minKitFiles = 10 } = {}) {
  const listing = execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
  const kit = listing.filter((e) => e.includes('__tests__/conformance/') && /\.test\.ts$/.test(e));
  if (kit.length < minKitFiles) {
    throw new Error(`Conformance kit missing from archive: ${kit.length} conformance test(s) shipped (expected >= ${minKitFiles}). Check the haiClient .gitattributes test-exclusion/un-ignore rules.`);
  }
  const strayTests = listing.filter((e) => /\.(test|spec)\.ts$/.test(e) && !e.includes('__tests__/conformance/'));
  if (strayTests.length > 0) {
    throw new Error(`Non-conformance test(s) shipped in archive (expected only the conformance kit): ${strayTests.slice(0, 10).join(', ')}`);
  }
}

/**
 * @param {{ repoPath: string, outDir: string, now?: Date, allowlist?: string[] }} opts
 * @returns {{ version: string, zipFile: string, zipBytes: number, builtAt: string }}
 */
export function buildAgentZip({ repoPath, outDir, now = new Date(), allowlist = ALLOWLIST }) {
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

  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', zipPath, 'HEAD', '--', ...allowlist], { stdio: 'pipe' });

  const leaks = scanZipForDenylist(zipPath);
  if (leaks.length > 0) {
    // Fail closed: don't leave the leaking artifact on disk for a downstream
    // pipeline (e.g. Docker COPY) to pick up.
    try {
      if (existsSync(zipPath)) unlinkSync(zipPath);
    } catch {
      // best-effort cleanup — don't mask the real leak error below
    }
    const detail = leaks.slice(0, 20).map((h) => `  ${h.file}: "${h.term}"`).join('\n');
    throw new Error(`Agent archive leak: ${leaks.length} denylisted fingerprint(s) in ${zipFile}:\n${detail}`);
  }

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
  assertConformanceShipped(join(outDir, manifest.zipFile));
  console.log(`Built ${manifest.zipFile} (${manifest.zipBytes} bytes) for agent v${manifest.version}`);
}
