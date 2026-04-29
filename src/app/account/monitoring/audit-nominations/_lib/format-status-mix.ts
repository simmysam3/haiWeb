import type { SkuObligationStatus } from '@haiwave/protocol';

const CANONICAL_ORDER: SkuObligationStatus[] = [
  'outstanding',
  'acknowledged',
  'partially_resolved',
  'fully_resolved',
  'declined',
  'blocked_non_participant',
];

export function formatStatusMix(
  counts: Partial<Record<SkuObligationStatus, number>>,
): string {
  return CANONICAL_ORDER
    .filter((status) => (counts[status] ?? 0) > 0)
    .map((status) => `${counts[status]} ${status}`)
    .join(' | ');
}
