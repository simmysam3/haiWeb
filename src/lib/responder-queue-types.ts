import type { SkuObligationStatus, ResolutionClass } from '@haiwave/protocol';

export interface InboundNominationRow {
  obligation_id: string;
  observer_participant_id: string;
  observer_display_name: string;
  // null on an identity-redacted (chain-owned) obligation — the real sub-tier
  // sku is hidden; sku_label carries the concept label instead (D-119).
  product_id: string | null;
  sku_label: string;
  status: SkuObligationStatus;
  arrival_time: string; // ISO 8601 — alias for SkuObligation.created_at
  resolution_class: ResolutionClass;
  unresolved_subtier_count: number;
}

export interface InboundNominationGroup {
  product_id: string | null; // null when the group is an identity-redacted concept (D-119)
  sku_label: string;
  request_count: number;
  earliest_arrival: string;
  status_mix: Partial<Record<SkuObligationStatus, number>>;
  observers: InboundNominationRow[];
}

export interface ResponderQueueFilters {
  status?: SkuObligationStatus[];
  observer_id?: string[];
  product_class?: string[];
}
