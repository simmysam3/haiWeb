import { describe, it, expect } from 'vitest';
import { EVIDENCE_SCOPE_SHAPES, EVIDENCE_RECIPIENT_TYPES, EVIDENCE_DISPATCH_DECISIONS, EVIDENCE_ATTESTATION_KINDS, DOCUMENT_FORMATS } from '../evidence-protocol-mirror';
// Value-import from protocol is allowed in a NON-'use client' test/module.
import { EvidenceScopeShapeSchema, EvidenceRecipientTypeSchema, EvidenceDispatchDecisionSchema, AttestationKindSchema, DocumentFormatSchema } from '@haiwave/protocol';

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

it('DOCUMENT_FORMATS stays in lockstep with protocol DocumentFormatSchema', () => {
  expect([...DOCUMENT_FORMATS]).toEqual(DocumentFormatSchema.options);
});
