import { describe, expect, it } from 'vitest';
import type {
  WatcherResult,
  WatcherPayload,
  SignalType,
  SkuAsk,
} from '@haiwave/protocol';
import { pivotReadiness, type RunRef } from '../pivot-readiness';

// One SKU, one vendor, observed across two runs. Each run carries the four
// readiness signals with distinct per-column numbers so we can assert both the
// fold (published/calibrated/soft-quoted/capacity) and the newest-first order.
const SKU = 'SKU-COMPRESSOR-BLADE';
const VENDOR = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const RUN_OLD = '11111111-1111-1111-1111-111111111111';
const RUN_NEW = '22222222-2222-2222-2222-222222222222';

let seq = 0;
function result(
  runId: string,
  signalType: SignalType,
  payload: WatcherPayload,
): WatcherResult {
  seq += 1;
  return {
    result_id: `00000000-0000-0000-0000-${String(seq).padStart(12, '0')}`,
    run_id: runId,
    counterparty_participant_id: VENDOR,
    signal_type: signalType,
    synthesis_mode: 'direct',
    payload,
    gap_reason: null,
    observed_at: '2026-06-15T00:00:00Z',
    tier: 1,
    aggregated_under_tier_1: null,
    external_product_id: SKU,
  };
}

const runs: RunRef[] = [
  { run_id: RUN_OLD, triggered_at: '2026-06-01T00:00:00Z' },
  { run_id: RUN_NEW, triggered_at: '2026-06-15T00:00:00Z' },
];

const results: WatcherResult[] = [
  // --- older run ---
  result(RUN_OLD, 'published_lead_time', {
    kind: 'direct',
    days: 22,
    observed_at: '2026-06-01T00:00:00Z',
  }),
  result(RUN_OLD, 'order_fulfillment_history', {
    kind: 'direct',
    active_orders: [{ po_number: 'AO-OLD', quantity: 40, quoted_ship_date: '2026-07-01' }],
    recent_fulfillments: [],
    calibrated: { days: 14, sample_count: 5 },
  }),
  result(RUN_OLD, 'soft_quoted_lead_time', {
    kind: 'direct',
    days: 30,
    availability: 'available',
    ask_quantity: 40,
    resolved_via: 'phantom_demand_bom',
    observed_at: '2026-06-01T00:00:00Z',
  }),
  result(RUN_OLD, 'capacity_utilization_band', {
    kind: 'direct',
    band: 'high',
    observed_at: '2026-06-01T00:00:00Z',
  }),
  // --- newer run ---
  result(RUN_NEW, 'published_lead_time', {
    kind: 'direct',
    days: 20,
    observed_at: '2026-06-15T00:00:00Z',
  }),
  result(RUN_NEW, 'order_fulfillment_history', {
    kind: 'direct',
    active_orders: [{ po_number: 'AO-NEW', quantity: 40, quoted_ship_date: '2026-08-01' }],
    recent_fulfillments: [],
    calibrated: { days: 12, sample_count: 8 },
  }),
  result(RUN_NEW, 'soft_quoted_lead_time', {
    kind: 'direct',
    days: 34,
    availability: 'available',
    ask_quantity: 40,
    resolved_via: 'phantom_demand_bom',
    observed_at: '2026-06-15T00:00:00Z',
  }),
  result(RUN_NEW, 'capacity_utilization_band', {
    kind: 'direct',
    band: 'moderate',
    observed_at: '2026-06-15T00:00:00Z',
  }),
];

const skuAsks: SkuAsk[] = [
  { sku: SKU, ask_quantity: 40, target_days: 42 },
];

describe('pivotReadiness', () => {
  it('folds two runs of one SKU/vendor into a single readiness entry', () => {
    const skus = pivotReadiness(results, runs, skuAsks);

    expect(skus).toHaveLength(1);
    const sku = skus[0];
    expect(sku.sku).toBe(SKU);
    expect(sku.ask?.ask_quantity).toBe(40);
    expect(sku.ask?.target_days).toBe(42);
    expect(sku.vendors).toHaveLength(1);

    const vendor = sku.vendors[0];
    expect(vendor.vendor_id).toBe(VENDOR);

    // order_state comes from the NEWEST run's order_fulfillment_history payload.
    expect(vendor.order_state?.calibrated.days).toBe(12);
    expect(vendor.order_state?.active_orders[0]?.po_number).toBe('AO-NEW');

    // Two rows, newest run first.
    expect(vendor.lead_time_rows).toHaveLength(2);
    const [newest, older] = vendor.lead_time_rows;

    expect(newest.run_date).toBe('2026-06-15T00:00:00Z');
    expect(newest.published).toBe(20);
    expect(newest.calibrated).toBe(12);
    expect(newest.soft_quoted).toBe(34);
    expect(newest.soft_quoted_unavailable).toBe(false);
    expect(newest.capacity).toBe('moderate');

    expect(older.run_date).toBe('2026-06-01T00:00:00Z');
    expect(older.published).toBe(22);
    expect(older.calibrated).toBe(14);
    expect(older.soft_quoted).toBe(30);
    expect(older.capacity).toBe('high');
  });
});
