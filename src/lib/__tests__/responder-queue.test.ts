import { describe, it, expect } from 'vitest';
import type { InboundNominationRow } from '../responder-queue-types';
import { groupNominations } from '../responder-queue';

const row = (
  o: Partial<InboundNominationRow>,
): InboundNominationRow => ({
  obligation_id: 'obl-1',
  observer_participant_id: 'p-1',
  observer_display_name: 'Acme',
  product_id: 'prod-1',
  sku_label: 'WIDGET-7',
  status: 'outstanding',
  arrival_time: '2026-04-28T10:00:00Z',
  resolution_class: 'pending',
  unresolved_subtier_count: 0,
  ...o,
});

describe('groupNominations', () => {
  it('returns empty array for empty input', () => {
    expect(groupNominations([])).toEqual([]);
  });

  it('groups one observer one SKU', () => {
    const result = groupNominations([row({ obligation_id: 'a' })]);
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('prod-1');
    expect(result[0].request_count).toBe(1);
    expect(result[0].observers).toHaveLength(1);
    expect(result[0].status_mix).toEqual({ outstanding: 1 });
  });

  it('groups redacted nominations (null product_id) by concept label, not collapsed into one null group', () => {
    const result = groupNominations([
      row({ obligation_id: 'a', product_id: null, sku_label: 'Vibration monitoring unit' }),
      row({ obligation_id: 'b', product_id: null, sku_label: 'Hydraulic actuator' }),
      row({ obligation_id: 'c', product_id: null, sku_label: 'Vibration monitoring unit' }),
    ]);
    expect(result).toHaveLength(2); // two distinct concepts, not merged on null
    const vmu = result.find((g) => g.sku_label === 'Vibration monitoring unit')!;
    expect(vmu.product_id).toBeNull();
    expect(vmu.request_count).toBe(2);
  });

  it('groups multiple observers on same SKU', () => {
    const result = groupNominations([
      row({ obligation_id: 'a', observer_display_name: 'Acme', arrival_time: '2026-04-28T10:00:00Z' }),
      row({ obligation_id: 'b', observer_display_name: 'Globex', arrival_time: '2026-04-28T08:00:00Z' }),
      row({ obligation_id: 'c', observer_display_name: 'Initech', arrival_time: '2026-04-28T12:00:00Z' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].request_count).toBe(3);
    expect(result[0].observers.map((o) => o.observer_display_name)).toEqual(['Initech', 'Acme', 'Globex']);
    expect(result[0].earliest_arrival).toBe('2026-04-28T08:00:00Z');
  });

  it('separates groups by product_id', () => {
    const result = groupNominations([
      row({ obligation_id: 'a', product_id: 'prod-1', sku_label: 'WIDGET-7', arrival_time: '2026-04-28T10:00:00Z' }),
      row({ obligation_id: 'b', product_id: 'prod-2', sku_label: 'GASKET-2', arrival_time: '2026-04-28T08:00:00Z' }),
    ]);
    expect(result).toHaveLength(2);
    // earliest_arrival desc => prod-1 (10:00) first
    expect(result.map((g) => g.product_id)).toEqual(['prod-1', 'prod-2']);
  });

  it('aggregates mixed statuses into status_mix', () => {
    const result = groupNominations([
      row({ obligation_id: 'a', status: 'outstanding' }),
      row({ obligation_id: 'b', status: 'outstanding' }),
      row({ obligation_id: 'c', status: 'acknowledged' }),
    ]);
    expect(result[0].status_mix).toEqual({ outstanding: 2, acknowledged: 1 });
  });

  it('sorts groups by earliest_arrival desc', () => {
    const result = groupNominations([
      row({ obligation_id: 'a', product_id: 'p1', arrival_time: '2026-04-28T08:00:00Z' }),
      row({ obligation_id: 'b', product_id: 'p2', arrival_time: '2026-04-28T10:00:00Z' }),
      row({ obligation_id: 'c', product_id: 'p3', arrival_time: '2026-04-28T09:00:00Z' }),
    ]);
    expect(result.map((g) => g.product_id)).toEqual(['p2', 'p3', 'p1']);
  });
});
