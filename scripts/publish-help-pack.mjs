import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Assemble the HAIWAVE Help knowledge pack from exactly what the console serves, and publish it to Central
 * (DESIGN-2026-10-03 §5; plan C.2 HelpPackPayload, C.4). Run in the SAME tree whose private/agent-downloads/ is baked
 * into the haiWeb image, after build:agent-zip and render:guide-pdf, and after the haiWeb deploy that ships them.
 *
 *   npm run publish:help-pack -- --dry-run          # writes private/help-pack/help-pack.preview.json, publishes nothing
 *   HAICORE_URL=https://… HELP_PUBLISH_TOKEN=<haiwave_admin portal token> npm run publish:help-pack -- --publish
 *
 * The command takes exactly one argument, given after npm's `--`: --dry-run, or --publish for the live publish. A run
 * with no argument is refused, and so are any other argument (a misspelt one included), more than one argument, and
 * --publish while npm_config_dry_run is set (npm keeps a --dry-run typed before the `--` for itself). npm keeps every
 * other flag typed before the `--` too (--publish, a misspelt --dryrun, -n): the command cannot see one, so that run
 * is a run with no argument, and it is refused: it publishes nothing.
 *
 * The target Central must run with HELP_AGENT_ENABLED=true: with the flag off, PUT /api/v1/admin/help/packs is not
 * registered and the publish answers 404. The console's own HELP_AGENT_ENABLED can stay off until the pack is active.
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

/**
 * The SHA-256 of a file's raw bytes: the hash that render:guide-pdf records for the served PDF (and that
 * record:guide-pdf records for a PDF placed by hand).
 * @param {string} path
 */
function sha256OfFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
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
  if (sha256OfFile(join(downloads, 'configuration-guide.pdf')) !== guide.bodySha256) {
    throw new Error(
      'assemblePack: private/agent-downloads/configuration-guide.pdf is not the PDF that was recorded ' +
        '(configuration-guide.json bodySha256 differs). Render it again, which records it too: ' +
        'npm run render:guide-pdf -- <guide source file>, then publish. A PDF that was placed by hand is recorded with ' +
        'npm run record:guide-pdf -- <guide source file>.',
    );
  }
  const source = readFileSync(join(haicoreDir, 'docs', guide.sourceFile), 'utf8');
  if (sha256Hex(source) !== guide.sourceSha256) {
    throw new Error(
      `assemblePack: ${guide.sourceFile} is not the source that was recorded ` +
        '(configuration-guide.json sourceSha256 differs). Check HAICORE_DIR. If the guide changed, the served PDF must be ' +
        'rendered again from it, which records it too: npm run render:guide-pdf -- <guide source file>, then publish.',
    );
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
  // The token travels in a header, and fetch's own error for a value it cannot send quotes the whole value. So a
  // token that is not one line of visible ASCII is refused here, by a message that does not hold it.
  if (!/^[\x21-\x7e]+$/.test(env.HELP_PUBLISH_TOKEN)) {
    throw new Error('publish:help-pack: HELP_PUBLISH_TOKEN must be one line of visible ASCII, with no space or line break in it (the value is not printed)');
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
  // The command takes exactly one argument, --dry-run or --publish, and the live path is taken only for --publish
  // itself. Everything else is refused here, before anything is assembled, written or sent: a run with no argument,
  // an argument that is neither of the two (a misspelt one must never publish), more than one argument, and --publish
  // while npm_config_dry_run is set. npm keeps every flag typed before its `--` separator for itself and passes no
  // argument, so `npm run publish:help-pack --publish` arrives here as a run with no argument and is refused. When
  // the flag npm kept is --dry-run it also sets npm_config_dry_run: with no argument the refusal says so, and beside
  // --publish the two ask for opposite things. No other npm_config_ variable is read, and npm_config_publish is never
  // a go. A refusal exits 1, so exit 0 never means "did nothing" (docs/release-downloads.md, step 4).
  const args = process.argv.slice(2);
  const npmDryRun = process.env.npm_config_dry_run !== undefined;
  const unknown = args.find((arg) => arg !== '--dry-run' && arg !== '--publish');
  const refusal =
    unknown !== undefined
      ? `unknown argument ${JSON.stringify(unknown)}: the one argument is --dry-run or --publish`
      : args.length > 1
        ? `more than one argument came (${args.join(' ')}): the command takes exactly one, --dry-run or --publish`
        : args.length === 0
          ? npmDryRun
            ? 'no argument came and npm_config_dry_run is set: npm keeps a --dry-run typed before its "--" separator for itself'
            : 'no argument came: the command takes one, --dry-run or --publish, after npm\'s "--" separator (npm keeps a flag typed before it for itself)'
          : args[0] === '--publish' && npmDryRun
            ? '--publish came while npm_config_dry_run is set (npm keeps a --dry-run typed before its "--" separator for itself): the two ask for opposite things'
            : null;
  if (refusal !== null) {
    console.error(
      `publish:help-pack: ${refusal}. Refused: nothing was assembled or sent.\n` +
        'For a dry run: npm run publish:help-pack -- --dry-run\n' +
        'To publish:    npm run publish:help-pack -- --publish',
    );
    process.exit(1);
  }
  main({
    dryRun: args[0] !== '--publish',
    haiwebDir: resolve('.'),
    haicoreDir: resolve(process.env.HAICORE_DIR ?? '../haiCore'),
    env: process.env,
  }).then(
    (code) => process.exit(code),
    (err) => {
      // A request that could not be made rejects with only "fetch failed"; the reason is in the error's cause. The
      // cause's own message can be empty: for a host with more than one address (localhost) and nothing listening it
      // is an AggregateError, and the reason is in the messages of its `errors`, or failing those in its `code`. Only
      // the cause is read: nothing of the request or its headers is printed.
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause : null;
      const inner = Array.isArray(cause?.errors) ? cause.errors.map((e) => (e instanceof Error ? e.message : '')).filter(Boolean).join('; ') : '';
      const reason = cause ? cause.message || inner || (typeof cause.code === 'string' ? cause.code : '') : '';
      console.error(String(err instanceof Error ? err.message : err) + (reason ? `: ${reason}` : ''));
      process.exit(1);
    },
  );
}
