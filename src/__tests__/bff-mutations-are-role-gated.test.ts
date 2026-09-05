import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Role-matrix guard (D-211; generalises D-55). Every BFF route handler that
 * mutates state (POST / PUT / PATCH / DELETE) must carry a role gate: the
 * `withHaiCore` `role` option, `requireAdmin`, an in-handler `hasRole`, or the
 * query-guard editor check `forbidNonEditor`. `hasRole(user, 'account_admin')`
 * is the transact-level gate. Read-only GETs stay session-only, with the one
 * exception below, which reveals a plaintext credential.
 *
 * Routes that are deliberately open to any session are allowlisted with the
 * reason, so a new mutation route cannot ship ungated by accident.
 */
const API_ROOT = join(__dirname, '..', 'app', 'api');
const MUTATION = /export (?:const|async function) (POST|PUT|PATCH|DELETE)\b/g;
const GATE = /(role:\s*['"]|requireAdmin|hasRole\(|forbidNonEditor\()/;

export const OPEN_BY_DESIGN: Record<string, string> = {
  'auth/logout/route.ts': 'ends the caller\'s own session',
  'auth/refresh/route.ts': 'refreshes the caller\'s own session',
  'webhooks/stripe/route.ts': 'Stripe signature is the credential (D-63)',
  'aliases/suggest/route.ts': 'session + zod-validated suggestion, nothing persisted (D-60)',
  'account/notifications/[id]/read/route.ts': 'marks the caller\'s own notification read',
  'account/rules/test/route.ts': 'dry-run evaluator, nothing persisted',
  'account/query-guard/test/route.ts': 'dry-run evaluator, nothing persisted',
};

/** GET handlers that must be gated anyway. */
const GATED_READS = ['account/provenance-keys/[keyId]/value/route.ts'];

export function hasGate(source: string): boolean {
  return GATE.test(source);
}
export function mutationExports(source: string): string[] {
  return [...source.matchAll(MUTATION)].map((m) => m[1]);
}

function* routeFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* routeFiles(full);
    } else if (entry === 'route.ts') {
      yield full;
    }
  }
}

describe('every mutating BFF route carries a role gate (D-211)', () => {
  it('detects gates and mutations (positive controls)', () => {
    expect(hasGate("export const POST = withHaiCore(async () => 1, { role: 'account_admin' });")).toBe(true);
    expect(hasGate('const forbidden = forbidNonEditor(session);')).toBe(true);
    expect(hasGate('export const POST = withHaiCore(async () => 1);')).toBe(false);
    expect(mutationExports('export const GET = 1;\nexport const DELETE = 2;\nexport async function PATCH() {}')).toEqual(['DELETE', 'PATCH']);
  });

  it('finds no ungated mutation route outside the allowlist', () => {
    const ungated: string[] = [];
    for (const file of routeFiles(API_ROOT)) {
      const rel = relative(API_ROOT, file);
      const source = readFileSync(file, 'utf8');
      if (mutationExports(source).length === 0) continue;
      if (rel in OPEN_BY_DESIGN) continue;
      if (!hasGate(source)) ungated.push(rel);
    }
    expect(ungated).toEqual([]);
  });

  it('keeps the allowlist honest: every entry exists and still has a mutation handler', () => {
    for (const rel of Object.keys(OPEN_BY_DESIGN)) {
      const source = readFileSync(join(API_ROOT, rel), 'utf8');
      expect(mutationExports(source).length, rel).toBeGreaterThan(0);
    }
  });

  it('gates the reads that reveal a credential', () => {
    for (const rel of GATED_READS) {
      expect(hasGate(readFileSync(join(API_ROOT, rel), 'utf8')), rel).toBe(true);
    }
  });
});
