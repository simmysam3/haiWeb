import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Assemble the HAIWAVE Help knowledge pack from exactly what the console serves, and publish it to Central
 * (DESIGN-2026-10-03 §5; plan C.2 HelpPackPayload, C.4). Run in the SAME tree whose private/agent-downloads/ is baked
 * into the haiWeb image, after build:agent-zip and build:guide-pdf, and after the haiWeb deploy that ships them.
 *
 *   npm run publish:help-pack -- --dry-run          # writes private/help-pack/help-pack.preview.json, publishes nothing
 *   HAICORE_URL=https://… HELP_PUBLISH_TOKEN=<haiwave_admin portal token> npm run publish:help-pack
 *
 * HAICORE_DIR (default ../haiCore) is the haiCore checkout holding docs/ and docs/help/. The brief lint runs on the
 * server only (plan R1); a 422 prints its violations. Exit 0 = published (or dry run); 1 = refused or failed.
 */

/** The deployment files customers already hold, read from the served zip (spec §5.1; phase-1 contract note 2, owner ruling A). */
export const DEPLOY_DOC_PATHS = ['.env.example', 'Dockerfile', '.dockerignore', 'scripts/docker-entrypoint.sh', 'README.md', 'UPGRADING.md'];
const DOCS_MD_RE = /^docs\/[^/]+\.md$/;
const BRIEF_RE = /^SUPPORT-BRIEF-\d{4}-\d{2}-\d{2}\.md$/;
const AS_BUILT_RE = /^\d{1,2}-\d{1,2}_as_built\.md$/;

/** @param {string} text */
export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The guide part: the source markdown without HTML comments and without its `## Change log` section. */
export function stripGuideForPack(markdown) {
  const out = [];
  let skipping = false;
  for (const line of markdown.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    if (/^## /.test(line)) skipping = /^## Change log\s*$/i.test(line);
    if (!skipping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Every `NAME=` assignment in .env.example, set or commented out, sorted and unique. */
export function parseKnownEnvVars(envExample) {
  const names = new Set();
  for (const line of envExample.split('\n')) {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}

/** The leading `---` block's `key: value` pairs, or null. */
export function parseFrontMatter(md) {
  const lines = md.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (close === -1) return null;
  const data = {};
  for (const line of lines.slice(1, close)) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (m) data[m[1]] = m[2].trim();
  }
  return data;
}

/** The newest SUPPORT-BRIEF-YYYY-MM-DD.md in the directory. */
export function latestBriefFile(briefDir) {
  const files = existsSync(briefDir) ? readdirSync(briefDir).filter((f) => BRIEF_RE.test(f)).sort() : [];
  if (files.length === 0) throw new Error(`latestBriefFile: no SUPPORT-BRIEF-YYYY-MM-DD.md in ${briefDir}`);
  return files[files.length - 1];
}

export function listZipEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
}

/** One entry as text. `unzip` reads the name as a wildcard pattern, so `\`, `*`, `?` and `[` are escaped: the entry read is exactly the one named. */
export function readZipText(zipPath, entry) {
  return execFileSync('unzip', ['-p', zipPath, entry.replace(/[\\*?[]/g, '\\$&')], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}

/** The six fixed deployment files plus every top-level docs/*.md the served zip carries (the owner-approved docs Task 1.9 allowlists). */
export function collectDeployDocs(zipPath) {
  const entries = new Set(listZipEntries(zipPath));
  const missing = DEPLOY_DOC_PATHS.filter((p) => !entries.has(p));
  if (missing.length > 0) throw new Error(`collectDeployDocs: the served agent zip lacks ${missing.join(', ')}`);
  const docs = [...entries].filter((e) => DOCS_MD_RE.test(e)).sort();
  return [...DEPLOY_DOC_PATHS, ...docs].map((path) => ({ path, content: readZipText(zipPath, path) }));
}

function gitCommitTime(repo, path) {
  const out = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%ct', '--', path]).toString().trim();
  return out ? Number(out) : 0;
}

function gitHead(repo) {
  return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD']).toString().trim();
}

/** Spec §5.3 freshness: warn (never fail) when an as-built edition was committed after the brief's own. */
export function newerAsBuiltWarning({ haicoreDir, briefAsBuilt, commitTime = gitCommitTime }) {
  const editions = readdirSync(join(haicoreDir, 'docs')).filter((f) => AS_BUILT_RE.test(f));
  const briefTime = commitTime(haicoreDir, `docs/${briefAsBuilt}`);
  const newer = editions.filter((f) => f !== briefAsBuilt && commitTime(haicoreDir, `docs/${f}`) > briefTime).sort();
  return newer.length > 0
    ? `⚠ newer as-built edition(s) than the brief's ${briefAsBuilt}: ${newer.join(', ')} — write a new support brief before the next pack (spec §5.3)`
    : null;
}

/** The HelpPackPayload (plan C.2) from exactly what this tree serves; refuses on either SHA mismatch (spec §5.4). */
export function assemblePack({ haiwebDir, haicoreDir, now = new Date(), head = gitHead }) {
  const downloads = join(haiwebDir, 'private', 'agent-downloads');
  const guide = JSON.parse(readFileSync(join(downloads, 'configuration-guide.json'), 'utf8'));
  const body = readFileSync(join(haiwebDir, 'design', 'configuration-guide', 'body.html'), 'utf8');
  if (sha256Hex(body) !== guide.bodySha256) {
    throw new Error(
      'assemblePack: design/configuration-guide/body.html is not the body the served PDF was built from ' +
        '(configuration-guide.json bodySha256 differs). Re-run npm run build:guide-pdf, then publish.',
    );
  }
  const source = readFileSync(join(haicoreDir, 'docs', guide.sourceFile), 'utf8');
  if (sha256Hex(source) !== guide.sourceSha256) {
    throw new Error(`assemblePack: ${guide.sourceFile} changed since the served PDF was built. Re-author and re-render the guide, then publish.`);
  }
  const agent = JSON.parse(readFileSync(join(downloads, 'manifest.json'), 'utf8'));
  const zipFile = basename(agent.zipFile);
  const deployDocs = collectDeployDocs(join(downloads, zipFile));
  const consolePages = readFileSync(join(haiwebDir, 'design', 'help', 'console-pages.md'), 'utf8');
  const briefDir = join(haicoreDir, 'docs', 'help');
  const briefFile = latestBriefFile(briefDir);
  const brief = readFileSync(join(briefDir, briefFile), 'utf8');
  const fm = parseFrontMatter(brief) ?? {};
  return {
    schema_version: 1,
    manifest: {
      guide: {
        edition: guide.edition,
        source_file: guide.sourceFile,
        source_sha256: guide.sourceSha256,
        body_sha256: guide.bodySha256,
        pdf_built_at: guide.builtAt,
      },
      agent: { version: agent.version, zip_file: zipFile },
      brief: { file: briefFile, date: fm.date ?? '', reviewed_by: fm.reviewed_by ?? '', as_built: fm.as_built ?? '' },
      console_pages_sha256: sha256Hex(consolePages),
      built_at: now.toISOString(),
      built_from: { haiweb_commit: head(haiwebDir), haicore_commit: head(haicoreDir) },
    },
    parts: {
      guide: stripGuideForPack(source),
      deploy_docs: deployDocs,
      console_pages: consolePages,
      brief,
    },
    known_env_vars: parseKnownEnvVars(deployDocs.find((d) => d.path === '.env.example').content),
  };
}

/**
 * The part of `fetch` the publisher uses, so a test can pass a fake.
 * @typedef {(url: string, init: RequestInit) => Promise<{ status: number, text: () => Promise<string> }>} HelpPackFetch
 */

/**
 * @param {{ haicoreUrl: string, token: string, protocolVersion: string, payload: unknown, fetchImpl?: HelpPackFetch }} opts
 */
export async function publishPack({ haicoreUrl, token, protocolVersion, payload, fetchImpl = fetch }) {
  const res = await fetchImpl(`${haicoreUrl.replace(/\/+$/, '')}/api/v1/admin/help/packs`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-haiwave-protocol-version': protocolVersion },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

export function formatViolations(violations) {
  return violations.map((v) => `  - [${v.rule}] ${v.match}${v.line == null ? '' : ` (brief line ${v.line})`}`).join('\n');
}

/**
 * @param {{ dryRun: boolean, haiwebDir: string, haicoreDir: string, env: Record<string, string | undefined>,
 *           fetchImpl?: HelpPackFetch, head?: (repo: string) => string, commitTime?: (repo: string, path: string) => number,
 *           log?: (message: string) => void, warn?: (message: string) => void }} opts
 * @returns {Promise<number>} the exit code
 */
export async function main({ dryRun, haiwebDir, haicoreDir, env, fetchImpl = fetch, head = gitHead, commitTime = gitCommitTime, log = console.log, warn = console.warn }) {
  const payload = assemblePack({ haiwebDir, haicoreDir, head });
  const { brief, guide, agent } = payload.manifest;
  if (!brief.reviewed_by) {
    throw new Error(`publish:help-pack: ${brief.file} has no reviewed_by — owner review is required before publishing (spec §5.3)`);
  }
  const stale = newerAsBuiltWarning({ haicoreDir, briefAsBuilt: brief.as_built, commitTime });
  if (stale) warn(stale);
  const summary = `guide ${guide.edition} (${guide.source_file}), agent ${agent.version}, brief ${brief.file}`;
  if (dryRun) {
    const dir = join(haiwebDir, 'private', 'help-pack');
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'help-pack.preview.json');
    writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
    log(`Dry run: wrote ${out} — ${summary}`);
    return 0;
  }
  if (!env.HAICORE_URL || !env.HELP_PUBLISH_TOKEN) {
    throw new Error('publish:help-pack needs HAICORE_URL and HELP_PUBLISH_TOKEN (a haiwave_admin portal token)');
  }
  const protocolVersion = JSON.parse(readFileSync(join(haicoreDir, 'packages', 'protocol', 'package.json'), 'utf8')).version;
  const { status, body } = await publishPack({ haicoreUrl: env.HAICORE_URL, token: env.HELP_PUBLISH_TOKEN, protocolVersion, payload, fetchImpl });
  if (status === 201) {
    log(`Published help pack ${body.version} (${body.pack_id}) — now active — ${summary}`);
    return 0;
  }
  if (status === 422) {
    warn(`Help pack refused (422 HELP_PACK_INVALID):\n${formatViolations(body?.error?.details?.violations ?? [])}`);
    return 1;
  }
  warn(`Publish failed: HTTP ${status} ${JSON.stringify(body)}`);
  return 1;
}

/**
 * True when this file is the process's entry point, false when it is imported (the tests import its functions).
 * Real paths on both sides. A file URL encodes a space, `#`, `%` and every non-ASCII character, and through a symlink
 * argv[1] is the link while import.meta.url is the file it points to: compared as text the two can differ, and the
 * command would then print nothing, send nothing and exit 0. An argv[1] that is absent or names no file has no real
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
    dryRun: process.argv.includes('--dry-run'),
    haiwebDir: resolve('.'),
    haicoreDir: resolve(process.env.HAICORE_DIR ?? '../haiCore'),
    env: process.env,
  }).then(
    (code) => process.exit(code),
    (err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    },
  );
}
