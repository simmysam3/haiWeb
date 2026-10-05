/**
 * Default-deny allowlist for the distributed agent archive. Only these paths
 * are shipped (via `git archive HEAD -- <allowlist>`); everything else — internal
 * docs (docs/ ships only file by file, each one reviewed: see below), ops scripts,
 * CLAUDE.md, kill scripts, deploy-agent.sh, demo data — is
 * excluded by default. Determined by what the build (tsc), the Docker image, and
 * the runtime entrypoint actually need, plus adopter-facing meta. Keep in sync
 * with the spec 2026-07-10-agent-archive-allowlist-design.md. Adding an
 * adopter-facing file? Enroll it here or it will not ship (the invariant test
 * guards known-required entries).
 *
 * Fail-loud: `git archive HEAD -- <paths>` exits non-zero if ANY listed path
 * matches nothing. So renaming/removing an allowlisted file (e.g. UPGRADING.md,
 * vitest.config.ts) hard-fails the archive build with a raw git error — the safe
 * direction (loud, never silent under-inclusion). Update this list when you
 * rename or remove an entry.
 */
export const ALLOWLIST = [
  // code & build inputs
  'src', 'packages', 'haicore-protocol', 'frontend', 'public', 'config',
  // manifests & build config
  'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.typecheck.json', 'vitest.config.ts',
  // container build + runtime (Dockerfile COPYs these three scripts; entrypoint runs seed-config, which imports hash-chat-password)
  'Dockerfile', 'docker-compose.yml', '.dockerignore',
  'scripts/docker-entrypoint.sh', 'scripts/seed-config.mjs', 'scripts/hash-chat-password.mjs',
  // adopter docs & meta
  'README.md', 'UPGRADING.md', 'LICENSE', '.env.example', '.gitignore',
  // haiClient operator docs, FILE BY FILE (owner ruling A, 2026-10-03; customer-safety read
  // ~/dev/hw/reports/REPORT-2026-10-04-agent-docs-customer-safety.md). Never add 'docs' or 'docs/': an unreviewed doc must
  // not ship by default. A new doc needs its own read + the owner's approval + a line here and in the test's APPROVED_DOCS.
  // Fail-loud like every entry: renaming or removing one of these in haiClient breaks the archive build on purpose.
  'docs/identity-provider.md', 'docs/typed-memory.md',
  // Fixed upstream for customer use (haiClient PR #290, merged 2026-10-05 as d7a69aa3), re-read, and approved by the owner.
  'docs/counterparty-sync.md', 'docs/erp-connector.md', 'docs/erp-write-enable.md', 'docs/work-queue.md',
];
