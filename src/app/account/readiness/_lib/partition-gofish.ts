import type { GoFishAggregatedResponse } from '@haiwave/protocol';

type GoFishResultItem = GoFishAggregatedResponse['results'][number];

type PartitionResult = {
  existing: GoFishResultItem[];
  newSource: GoFishResultItem[];
};

export function partitionGoFish(results: GoFishResultItem[]): PartitionResult {
  const existing: GoFishResultItem[] = [];
  const newSource: GoFishResultItem[] = [];
  for (const r of results) {
    const state = r.relationship_state;
    if (state === 'approved' || state === 'trading_pair') {
      existing.push(r);
    } else if (state === 'none' || state === undefined) {
      newSource.push(r);
    }
    // 'blocked' is dropped — not shown to user
  }
  return { existing, newSource };
}
