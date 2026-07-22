import type {
  WatcherResult,
  WatcherPayload,
  SkuAsk,
  OrderFulfillmentHistoryPayload,
  PublishedLeadTimePayload,
  SoftQuotedLeadTimePayload,
  CapacityUtilizationBand,
} from '@haiwave/protocol';
import type { LeadTimeHistoryRow } from '../_components/lead-time-history-table';

// Pure pivot for the readiness watcher run-detail page. Folds the flat
// WatcherResult stream (across the trailing runs) into a SKU -> vendor
// hierarchy the <ReadinessReport> renders directly.
//
//   ReadinessSku      = one watched SKU, its forward-demand ask, its vendors
//   ReadinessVendor   = one supplier: current order state + per-run lead-time
//                       history (newest run first)
//
// No React, no I/O — deterministic transform so it can be unit-tested in
// isolation and reused server-side.

export interface RunRef {
  run_id: string;
  triggered_at: string;
}

export interface ReadinessVendor {
  vendor_id: string;
  vendor_name: string;
  // Newest run's order_fulfillment_history payload for this (sku, vendor);
  // null when the vendor never reported one across the trailing runs.
  order_state: OrderFulfillmentHistoryPayload | null;
  // One row per run, newest first.
  lead_time_rows: LeadTimeHistoryRow[];
}

export interface ReadinessSku {
  sku: string;
  ask: SkuAsk | null;
  product_name: string;
  vendors: ReadinessVendor[];
}

function emptyRow(runDate: string): LeadTimeHistoryRow {
  return {
    run_date: runDate,
    published: null,
    calibrated: null,
    soft_quoted: null,
    soft_quoted_unavailable: false,
    capacity: null,
  };
}

// The payload union carries no discriminator that ties it back to signal_type,
// so we gate on signal_type (which we already trust) and read the matching
// member's fields. The `as` narrows within the union — never `any`.
function foldSignalIntoRow(row: LeadTimeHistoryRow, result: WatcherResult): void {
  const payload = result.payload;
  if (!payload) return;
  switch (result.signal_type) {
    case 'published_lead_time':
      row.published = (payload as PublishedLeadTimePayload).days;
      break;
    case 'order_fulfillment_history':
      row.calibrated = (payload as OrderFulfillmentHistoryPayload).calibrated.days;
      break;
    case 'soft_quoted_lead_time': {
      const soft = payload as SoftQuotedLeadTimePayload;
      row.soft_quoted = soft.days;
      row.soft_quoted_unavailable = soft.availability === 'unavailable';
      break;
    }
    case 'capacity_utilization_band':
      row.capacity = (payload as CapacityUtilizationBand).band;
      break;
    default:
      break;
  }
}

function newestOrderState(
  rows: WatcherResult[],
  runDateById: Map<string, string>,
): OrderFulfillmentHistoryPayload | null {
  let best: { at: number; payload: OrderFulfillmentHistoryPayload } | null = null;
  for (const result of rows) {
    if (result.signal_type !== 'order_fulfillment_history' || !result.payload) continue;
    const at = Date.parse(runDateById.get(result.run_id) ?? '');
    if (!best || at > best.at) {
      best = { at, payload: result.payload as OrderFulfillmentHistoryPayload };
    }
  }
  return best ? best.payload : null;
}

export function pivotReadiness(
  results: WatcherResult[],
  runs: RunRef[],
  skuAsks: SkuAsk[],
  productNameByExtId: Record<string, string> = {},
  partnerNameById: Map<string, string> = new Map(),
): ReadinessSku[] {
  const runDateById = new Map<string, string>();
  for (const run of runs) runDateById.set(run.run_id, run.triggered_at);

  const askBySku = new Map<string, SkuAsk>();
  for (const ask of skuAsks) askBySku.set(ask.sku, ask);

  // sku -> vendor -> results. Only per-product, per-vendor rows participate in
  // the readiness view; vendor-aggregate rows (null sku or null vendor) drop out.
  const bySku = new Map<string, Map<string, WatcherResult[]>>();
  for (const result of results) {
    const sku = result.external_product_id;
    const vendor = result.counterparty_participant_id;
    if (!sku || !vendor) continue;
    let byVendor = bySku.get(sku);
    if (!byVendor) {
      byVendor = new Map<string, WatcherResult[]>();
      bySku.set(sku, byVendor);
    }
    const list = byVendor.get(vendor);
    if (list) list.push(result);
    else byVendor.set(vendor, [result]);
  }

  const skus: ReadinessSku[] = [];
  for (const [sku, byVendor] of bySku) {
    const vendors: ReadinessVendor[] = [];
    for (const [vendorId, vendorRows] of byVendor) {
      const rowByRun = new Map<string, LeadTimeHistoryRow>();
      for (const result of vendorRows) {
        let row = rowByRun.get(result.run_id);
        if (!row) {
          row = emptyRow(runDateById.get(result.run_id) ?? '');
          rowByRun.set(result.run_id, row);
        }
        foldSignalIntoRow(row, result);
      }

      const leadTimeRows = [...rowByRun.values()].sort(
        (a, b) => Date.parse(b.run_date) - Date.parse(a.run_date),
      );

      vendors.push({
        vendor_id: vendorId,
        vendor_name: partnerNameById.get(vendorId) ?? vendorId,
        order_state: newestOrderState(vendorRows, runDateById),
        lead_time_rows: leadTimeRows,
      });
    }

    skus.push({
      sku,
      ask: askBySku.get(sku) ?? null,
      product_name: productNameByExtId[sku] ?? sku,
      vendors,
    });
  }

  return skus;
}
