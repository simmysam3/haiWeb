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
  published_lead_time: {
    label: 'Published lead time',
    tooltip: 'Counterparty-advertised standard lead time for a SKU — what they publish on their product surface for everyone to see.',
  },
  quoted_lead_time: {
    label: 'Quoted lead time',
    tooltip: 'Counterparty-quoted lead time for a SKU under your specific trading relationship — typically tighter than the published figure.',
  },
  order_fulfillment_history: {
    label: 'Order state',
    tooltip: 'Active orders and recent quoted-vs-actual ship dates for this SKU.',
  },
  soft_quoted_lead_time: {
    label: 'Soft-quoted',
    tooltip: 'Live best-effort lead time for the ask quantity, from a phantom-demand traversal.',
  },
};
