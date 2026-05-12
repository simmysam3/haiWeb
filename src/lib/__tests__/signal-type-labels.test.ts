import { describe, it, expect } from 'vitest';
import { SignalTypeSchema } from '@haiwave/protocol';
import { SIGNAL_TYPE_LABELS } from '../signal-type-labels';

describe('SIGNAL_TYPE_LABELS', () => {
  it('has a label entry for every protocol SignalType enum value', () => {
    // Exhaustiveness gate: if a new SignalType is added to the protocol
    // without a label entry, this test fails so the omission is caught
    // before a user sees a raw enum value in the UI.
    const protocolValues = SignalTypeSchema.options;
    const labelKeys = Object.keys(SIGNAL_TYPE_LABELS).sort();
    expect(labelKeys).toEqual([...protocolValues].sort());
  });

  it('every entry has non-empty label and tooltip', () => {
    for (const [key, entry] of Object.entries(SIGNAL_TYPE_LABELS)) {
      expect(entry.label, `label for ${key}`).toBeTruthy();
      expect(entry.tooltip, `tooltip for ${key}`).toBeTruthy();
    }
  });
});
