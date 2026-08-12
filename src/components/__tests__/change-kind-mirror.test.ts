import { describe, it, expect } from 'vitest';
// The mirror exists BECAUSE client components can't value-import the CJS
// protocol package (pill.tsx:157 comment). Tests CAN — so the test is where
// the two copies meet.
import { CHANGE_KIND_DEFINITION } from '@haiwave/protocol';
import { definitionFor, changeKindMirrorKeys } from '../pill';

describe('pill.tsx change_kind mirror ↔ protocol CHANGE_KIND_DEFINITION', () => {
  it('mirrors every protocol kind byte-for-byte', () => {
    // Named mutation: edit one mirrored string in pill.tsx (or add a kind to
    // the protocol without mirroring it) → this fails.
    // Direction is protocol ⊆ mirror: the mirror MAY carry kinds ahead of the
    // installed protocol version (v1.73 forward-carries upstream_risk_reported
    // before WP3's 3.66.0 lands) — those extras are asserted by name below so
    // nothing unknown hides in the mirror.
    for (const [kind, definition] of Object.entries(CHANGE_KIND_DEFINITION)) {
      expect(definitionFor('change_kind', kind), `mirror missing: ${kind}`).toBe(definition);
    }
  });

  it('mirror carries NO kinds beyond the installed protocol (3.66.0+: the forward-carry is over)', () => {
    const protocolKinds = new Set(Object.keys(CHANGE_KIND_DEFINITION));
    const extras = changeKindMirrorKeys().filter((k) => !protocolKinds.has(k));
    // ⚠ This assertion was VACUOUS from the moment 3.66.0 merged. It read
    //   `expect(extras.every((k) => k === 'upstream_risk_reported')).toBe(true)`
    // and `[].every(...)` is true for ANY predicate — so once the protocol
    // absorbed the forward-carried kind, `extras` emptied and the test could no
    // longer fail, whatever the mirror did. It was also the declared tripwire
    // for re-adding the EVENT_KIND_PILLS entry, so going quietly vacuous
    // cancelled the very reminder it existed to give.
    // Assert a KNOWN VALUE, never a predicate over a set that can empty.
    expect(extras).toEqual([]);
  });
});
