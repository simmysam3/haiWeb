import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * D-212: the Keycloak realm role is the single source of truth for a user's
 * portal role. The legacy `role` user attribute is neither written nor read.
 * This census fails on any source under src/ that touches it, so the attribute
 * cannot creep back as a shadow record.
 */
const SRC_ROOT = join(__dirname, '..');
// `attrs.role`, `attributes.role`, `attributes?.role`, and an attributes
// object literal that carries a `role:` key.
const ROLE_ATTRIBUTE = /\battr(?:ibute)?s\??\.role\b|attributes\s*:\s*\{[^}]*\brole\s*:/s;

export function touchesRoleAttribute(source: string): boolean {
  return ROLE_ATTRIBUTE.test(source);
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      yield* sourceFiles(full);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe('no source reads or writes the Keycloak `role` user attribute (D-212)', () => {
  it('detects the patterns (positive controls) and ignores unrelated role fields', () => {
    expect(touchesRoleAttribute("const r = attrs.role?.[0];")).toBe(true);
    expect(touchesRoleAttribute("kc.attributes?.role")).toBe(true);
    expect(touchesRoleAttribute("attributes: {\n participant_id: [id],\n role: [role],\n }")).toBe(true);
    expect(touchesRoleAttribute("session.user.role === 'account_owner'")).toBe(false);
    expect(touchesRoleAttribute("attributes: { participant_id: [id] }")).toBe(false);
  });

  it('finds no file under src that touches the attribute', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC_ROOT)) {
      if (touchesRoleAttribute(readFileSync(file, 'utf8'))) offenders.push(relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
