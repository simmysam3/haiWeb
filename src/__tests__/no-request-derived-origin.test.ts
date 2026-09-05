import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * D-62 regression guard. A server-side BFF fetch must take its origin from
 * the configured PORTAL_BASE_URL via `fetchBffJson` (src/lib/server-fetch.ts),
 * never from the incoming request's Host / X-Forwarded-* headers — behind an
 * edge that forwards unmatched Hosts, a spoofed header would steer the fetch
 * (and the caller's session cookie) to an attacker-controlled origin.
 *
 * This walks every non-test source file under src/app and fails on any read
 * of those headers. `next/headers` stays available for everything else
 * (cookies, the request cookie header, etc.).
 */
const APP_ROOT = join(__dirname, '..', 'app');
const FORBIDDEN = /\.get\(\s*['"`](host|x-forwarded-proto|x-forwarded-host)['"`]\s*\)/i;

export function findsRequestDerivedOrigin(source: string): boolean {
  return FORBIDDEN.test(source);
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* sourceFiles(full);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

describe('no server component derives its fetch origin from request headers (D-62)', () => {
  it('detects the forbidden pattern (positive control)', () => {
    expect(findsRequestDerivedOrigin("const host = h.get('host') ?? 'localhost:3001';")).toBe(true);
    expect(findsRequestDerivedOrigin('const proto = reqHeaders.get("x-forwarded-proto") ?? "http";')).toBe(true);
    expect(findsRequestDerivedOrigin("const cookie = h.get('cookie') ?? '';")).toBe(false);
  });

  it('finds no Host / X-Forwarded-* header reads under src/app', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      if (findsRequestDerivedOrigin(readFileSync(file, 'utf8'))) offenders.push(relative(APP_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
