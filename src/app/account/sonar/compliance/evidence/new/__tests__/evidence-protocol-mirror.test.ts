import { describe, it, expect } from 'vitest';
import { EVIDENCE_SCOPE_SHAPES, EVIDENCE_RECIPIENT_TYPES, EVIDENCE_DISPATCH_DECISIONS } from '../evidence-protocol-mirror';
// Value-import from protocol is allowed in a NON-'use client' test/module.
import { EvidenceScopeShapeSchema, EvidenceRecipientTypeSchema, EvidenceDispatchDecisionSchema, AttestationKindSchema } from '@haiwave/protocol';
import { EVIDENCE_ATTESTATION_KINDS } from '../evidence-protocol-mirror';

describe('inline mirror stays in sync with @haiwave/protocol', () => {
  it('scope shapes match', () => {
    expect([...EVIDENCE_SCOPE_SHAPES]).toEqual(EvidenceScopeShapeSchema.options);
  });
  it('recipient types match', () => {
    expect([...EVIDENCE_RECIPIENT_TYPES]).toEqual(EvidenceRecipientTypeSchema.options);
  });
  it('dispatch decisions match', () => {
    expect([...EVIDENCE_DISPATCH_DECISIONS]).toEqual(EvidenceDispatchDecisionSchema.options);
  });
  it('EVIDENCE_ATTESTATION_KINDS stays in lockstep with the protocol enum', () => {
    expect([...EVIDENCE_ATTESTATION_KINDS]).toEqual(AttestationKindSchema.options);
  });
});
