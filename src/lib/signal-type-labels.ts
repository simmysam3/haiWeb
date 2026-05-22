import type { SignalType } from '@haiwave/protocol';

export interface SignalTypeLabel {
  label: string;
  tooltip: string;
}

export const SIGNAL_TYPE_LABELS: Record<SignalType, SignalTypeLabel> = {
  lead_time_distribution: {
    label: 'Lead time distribution',
    tooltip: 'p50 / p75 / p90 / p95 / p99 fulfilment lead time over the last 90 days.',
  },
  capacity_utilization_band: {
    label: 'Capacity utilization band',
    tooltip: 'Latest reported production band: low, moderate, high, or at_capacity.',
  },
  delivery_event: {
    label: 'Latest delivery event',
    tooltip: 'Most recent shipment status — dispatched, in transit, delayed, delivered, or exception. Premier-tier counterparties only.',
  },
};
