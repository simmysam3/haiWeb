import type { SignalType } from '@haiwave/protocol';

/**
 * signal_type -> short chip label, shared by every watcher surface that
 * renders a compact signal pill (column packs, the triage strip, the new-
 * watcher scope picker). Exhaustive over SignalType so adding a new protocol
 * enum value forces a compile-time update here.
 */
export const SIGNAL_TYPE_ABBREVIATIONS: Record<SignalType, string> = {
  lead_time_distribution: 'LT',
  capacity_utilization_band: 'CAP',
  delivery_event: 'DEL',
  published_lead_time: 'PLT',
  quoted_lead_time: 'QLT',
  order_fulfillment_history: 'ORD',
  soft_quoted_lead_time: 'SQL',
};
