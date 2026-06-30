import { describe, it, expect } from 'vitest';
import { partitionGoFish } from '../partition-gofish';

describe('partitionGoFish', () => {
  it('puts existing relationships first, strangers second, drops blocked', () => {
    const { existing, newSource } = partitionGoFish([
      {
        rank: 2,
        participant_id: 'stranger-uuid',
        participant_name: 'Stranger Co',
        relationship_state: 'none' as const,
        offering: { quantity_available: 9999, lead_time_days: 20 },
        ranking_factors: { price_rank: 1, availability_rank: 1, shelf_age_rank: 1, behavioral_rank: 1, provenance_depth_rank: 1 },
      },
      {
        rank: 1,
        participant_id: 'mekong-uuid',
        participant_name: 'Mekong',
        relationship_state: 'trading_pair' as const,
        offering: { quantity_available: 3100, lead_time_days: 30 },
        ranking_factors: { price_rank: 1, availability_rank: 1, shelf_age_rank: 1, behavioral_rank: 1, provenance_depth_rank: 1 },
      },
      {
        rank: 3,
        participant_id: 'blocked-uuid',
        participant_name: 'Blocked Co',
        relationship_state: 'blocked' as const,
        offering: { quantity_available: 100, lead_time_days: 5 },
        ranking_factors: { price_rank: 1, availability_rank: 1, shelf_age_rank: 1, behavioral_rank: 1, provenance_depth_rank: 1 },
      },
    ]);
    expect(existing.map((r) => r.participant_name)).toEqual(['Mekong']);
    expect(newSource.map((r) => r.participant_name)).toEqual(['Stranger Co']);
  });
});
