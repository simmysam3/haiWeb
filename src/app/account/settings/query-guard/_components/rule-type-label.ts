import type { QueryGuardRuleType } from '@haiwave/protocol';

/**
 * Single source of truth for a query-guard rule type's display label.
 * `guard-rules-matrix.tsx` and `test-drawer.tsx` each held their own copy of
 * this map; at protocol 3.88.0 `QueryGuardRuleTypeSchema` widened from four
 * members to eight (the inquiry door's oracle rules, spec §10.2) and a
 * four-key local `Record<QueryGuardRuleType, string>` no longer satisfies
 * the type. Consolidated here so there is one declaration to widen.
 */
export const RULE_TYPE_LABEL: Record<QueryGuardRuleType, string> = {
  sku_repeat: 'sku_repeat',
  sku_breadth: 'sku_breadth',
  ad_hoc_cap: 'ad_hoc_cap',
  excess_volume: 'excess_volume',
  // v1.101 (3.88.0) — the inquiry door's oracle rules (spec §10.2):
  /** A second inquiry within the window on the same (subject, attribute) whose numeric operand moved by less than the threshold percentage. */
  operand_walk: 'operand_walk',
  /** Successive inquiries on the same (subject, attribute) that change a set or text operand, probing a certification list or scope one value at a time. */
  enumeration: 'enumeration',
  /** Requested quantity outside a multiple band of the requester's prior order volume with this responder, evaluated centrally from order_records. */
  volume_band: 'volume_band',
  /** Subjects in one request above the threshold. */
  multi_subject_request: 'multi_subject_request',
};
