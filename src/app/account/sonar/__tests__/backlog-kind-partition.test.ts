import { describe, it, expect } from 'vitest';
import { EVENT_KIND_PILLS as WATCHER_KINDS } from '../posture/changes/_lib/event-kind-pills';
import { EVENT_KIND_PILLS as AUDIT_KINDS } from '../audit/events/_lib/event-kind-pills';

describe('Watcher Backlog ↔ Event Backlog kind partition', () => {
  it('is disjoint (spec §5 — named mutation: add a kind to both sides → fails)', () => {
    const audit = new Set<string>(AUDIT_KINDS);
    const overlap = WATCHER_KINDS.filter((k) => audit.has(k));
    expect(overlap).toEqual([]);
  });
  it('upstream_risk_reported is watcher-side only', () => {
    expect(WATCHER_KINDS).toContain('upstream_risk_reported');
    expect(AUDIT_KINDS).not.toContain('upstream_risk_reported');
  });
});
