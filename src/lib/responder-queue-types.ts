import type { SkuObligationStatus, ResolutionClass } from '@haiwave/protocol';

export interface InboundNominationRow {
  obligation_id: string;
  observer_participant_id: string;
  observer_display_name: string;
  product_id: string;
  sku_label: string;
  status: SkuObligationStatus;
  arrival_time: string; // ISO 8601 — alias for SkuObligation.created_at
  resolution_class: ResolutionClass;
  unresolved_subtier_count: number;
}

export interface InboundNominationGroup {
  product_id: string;
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
