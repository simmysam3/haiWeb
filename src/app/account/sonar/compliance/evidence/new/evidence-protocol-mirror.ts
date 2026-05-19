// Sync with @haiwave/protocol EvidenceScopeShape / EvidenceRecipientType /
// EvidenceDispatchDecision. Turbopack cannot value-import the CJS
// @haiwave/protocol via the file: symlink on Windows in 'use client'
// components, so the runtime literals are mirrored here. The colocated
// test (__tests__/evidence-protocol-mirror.test.ts) asserts this stays in
// lockstep with the protocol enums.
export const EVIDENCE_SCOPE_SHAPES = [
  'sku_list', 'product_family', 'container_with_sku_list',
] as const;
export type EvidenceScopeShape = (typeof EVIDENCE_SCOPE_SHAPES)[number];

export const EVIDENCE_RECIPIENT_TYPES = [
  'customs', 'customer_audit', 'regulator', 'internal_review', 'other',
] as const;
export type EvidenceRecipientType = (typeof EVIDENCE_RECIPIENT_TYPES)[number];

export const EVIDENCE_DISPATCH_DECISIONS = ['cached', 'fresh'] as const;
export type EvidenceDispatchDecision = (typeof EVIDENCE_DISPATCH_DECISIONS)[number];
