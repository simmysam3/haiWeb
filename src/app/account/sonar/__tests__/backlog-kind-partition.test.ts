import { describe, it, expect } from 'vitest';
import { EVENT_KIND_PILLS as WATCHER_KINDS } from '../posture/changes/_lib/event-kind-pills';
import { EVENT_KIND_PILLS as AUDIT_KINDS } from '../audit/events/_lib/event-kind-pills';

describe('Watcher Backlog ↔ Event Backlog kind partition', () => {
  it('is disjoint (spec §5 — named mutation: add a kind to both sides → fails)', () => {
    const audit = new Set<string>(AUDIT_KINDS);
    const overlap = WATCHER_KINDS.filter((k) => audit.has(k));
    expect(overlap).toEqual([]);
  });
  it('upstream_risk_reported is in NEITHER array today (withheld until 3.66.0)', () => {
    // v1.73 WP4 fix wave: the kind is deliberately absent from BOTH pill
    // arrays until protocol 3.66.0 (WP3) mints it — EVENT_KIND_PILLS doubles
    // as the wire filter allowlist, and carrying an unminted literal there
    // made haiCore treat an all-unknown `kind` filter as no filter at all
    // (see event-kind-pills.ts's comment). Do NOT "fix" this back to
    // `toContain` before 3.66.0 lands.
    expect(WATCHER_KINDS).not.toContain('upstream_risk_reported');
    expect(AUDIT_KINDS).not.toContain('upstream_risk_reported');
  });
});
