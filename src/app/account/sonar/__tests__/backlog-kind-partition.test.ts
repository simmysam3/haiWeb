import { describe, it, expect } from 'vitest';
import { EVENT_KIND_PILLS as WATCHER_KINDS } from '../posture/changes/_lib/event-kind-pills';
import { EVENT_KIND_PILLS as AUDIT_KINDS } from '../audit/events/_lib/event-kind-pills';

describe('Watcher Backlog ↔ Event Backlog kind partition', () => {
  it('is disjoint (spec §5 — named mutation: add a kind to both sides → fails)', () => {
    const audit = new Set<string>(AUDIT_KINDS);
    const overlap = WATCHER_KINDS.filter((k) => audit.has(k));
    expect(overlap).toEqual([]);
  });
  it('upstream_risk_reported is on the WATCHER side only (3.66.0 landed; withholding over)', () => {
    // History, because the reason is not obvious from the assertion:
    // through Phase 1 this kind was deliberately absent from BOTH arrays until
    // protocol 3.66.0 (WP3) minted it. EVENT_KIND_PILLS doubles as the wire
    // filter allowlist, and carrying an UNMINTED literal there made haiCore
    // treat an all-unknown `kind` filter as no filter at all — returning the
    // entire compliance_changes feed, audit kinds included, on a watcher-only
    // surface (see event-kind-pills.ts's comment).
    // 3.66.0 landed 2026-08-12 (haiCore `8177ed3f`), so the literal is now
    // minted and belongs on the watcher side — it is a watcher-emitted signal,
    // exactly like the lead-time and promise-drift kinds.
    expect(WATCHER_KINDS).toContain('upstream_risk_reported');
    // Still excluded audit-side: that Exclude<> was a no-op while the kind was
    // unminted and is LOAD-BEARING now the union contains it.
    expect(AUDIT_KINDS).not.toContain('upstream_risk_reported');
  });
});
