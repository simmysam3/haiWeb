'use client';

import { useMemo, useState } from 'react';
import type { WatcherResult, WatcherSynthesisMode } from '@haiwave/protocol';
import {
  DetailChevron,
  GapTierBar,
  ScorePill,
  tierBucket,
  scoreOf,
} from '@/components/sonar/observations';
import { Pill } from '@/components/pill';
import { LeadTimeTriplet } from './lead-time-triplet';
import { CapacityBandPanel } from './capacity-band-panel';
import { DeliveryEventLog } from './delivery-event-log';

interface Props {
  results: WatcherResult[];
  /**
   * Optional `external_product_id` → display-name map, supplied by the page
   * via the `/api/account/sonar/manifest-catalog` BFF (Plan 3 E5). Missing
   * entries fall back to the raw external_product_id; a null id renders as
   * the canonical "Vendor-aggregate" placeholder.
   */
  productNameByExtId?: Record<string, string>;
}

const VENDOR_AGGREGATE_KEY = '__vendor_aggregate__';

interface ProductSubGroup {
  key: string;
  externalProductId: string | null;
  productName: string;
  results: WatcherResult[];
}

interface CounterpartyGroup {
  key: string;
  counterpartyId: string | null;
  counterpartyName: string;
  results: WatcherResult[];
  productSubGroups: ProductSubGroup[];
  gapTiers: Map<number, number>;
  score: number;
}

interface Numbered {
  days: number;
  observed_at: string;
  vendor_ref?: string;
}

interface Distribution {
  window_days: number;
  percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
  sample_count: number;
}

function nameOf(r: WatcherResult): string {
  // Sub-tier aggregate rows: identity is intentionally null (tier-2+ rollups).
  if (r.counterparty_participant_id === null) return 'Identity withheld';
  // Direct tier-1 rows: prefer the page-enriched counterparty_name; fall back
  // to the canonical "Vendor Name Not Disclosed" framing used elsewhere
  // (e.g. tree-view) rather than exposing a raw UUID slice.
  const named = (r as WatcherResult & { counterparty_name?: string | null })
    .counterparty_name;
  return named ?? 'Vendor Name Not Disclosed';
}

function gapTiersFor(results: WatcherResult[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of results) {
    if (r.synthesis_mode === 'redacted_gap') {
      const t = tierBucket(r.tier);
      m.set(t, (m.get(t) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Extract a numbered (published or quoted) lead-time payload from a list of
 * results filtered to one product sub-group. Returns the first non-redacted
 * direct payload found for `signalType`, or null if no usable result exists.
 */
function extractNumberedLeadTime(
  results: WatcherResult[],
  signalType: 'published_lead_time' | 'quoted_lead_time',
): Numbered | null {
  const r = results.find(
    (x) =>
      x.signal_type === signalType &&
      x.payload !== null &&
      x.synthesis_mode !== 'redacted_gap',
  );
  if (!r || !r.payload) return null;
  const p = r.payload as {
    days?: number;
    observed_at?: string;
    vendor_ref?: string;
  };
  if (typeof p.days !== 'number' || typeof p.observed_at !== 'string') return null;
  return { days: p.days, observed_at: p.observed_at, vendor_ref: p.vendor_ref };
}

function extractCalibrated(results: WatcherResult[]): Distribution | null {
  const r = results.find(
    (x) =>
      x.signal_type === 'lead_time_distribution' &&
      x.payload !== null &&
      x.synthesis_mode !== 'redacted_gap',
  );
  if (!r || !r.payload) return null;
  const p = r.payload as {
    window_days?: number;
    percentiles?: { p50: number; p75: number; p90: number; p95: number; p99: number };
    sample_count?: number;
  };
  if (
    typeof p.window_days !== 'number' ||
    !p.percentiles ||
    typeof p.sample_count !== 'number'
  ) {
    return null;
  }
  return {
    window_days: p.window_days,
    percentiles: p.percentiles,
    sample_count: p.sample_count,
  };
}

function signalRow(r: WatcherResult | undefined): {
  synthesisMode: WatcherSynthesisMode;
  payload: unknown;
} {
  if (!r) return { synthesisMode: 'redacted_gap', payload: null };
  return { synthesisMode: r.synthesis_mode, payload: r.payload };
}

export function CounterpartiesGrid({ results, productNameByExtId }: Props) {
  const [query, setQuery] = useState('');
  const [vendorExpanded, setVendorExpanded] = useState<Set<string>>(new Set());
  // Products are open by default once their vendor is expanded — the user
  // shouldn't have to click every product to see lead-time/capacity detail.
  // This set tracks the products the user has *explicitly collapsed*.
  const [productCollapsed, setProductCollapsed] = useState<Set<string>>(new Set());

  const groups: CounterpartyGroup[] = useMemo(() => {
    const byKey = new Map<string, CounterpartyGroup>();
    for (const r of results) {
      const key = r.counterparty_participant_id ?? '__identity_withheld__';
      let g = byKey.get(key);
      if (!g) {
        g = {
          key,
          counterpartyId: r.counterparty_participant_id,
          counterpartyName: nameOf(r),
          results: [],
          productSubGroups: [],
          gapTiers: new Map(),
          score: 0,
        };
        byKey.set(key, g);
      }
      g.results.push(r);
    }

    const list = Array.from(byKey.values()).map((g) => {
      const tiers = gapTiersFor(g.results);
      // Build per-product sub-groups. external_product_id=null collapses to
      // a single "Vendor-aggregate" sub-item (vendor-aggregate runs, i.e.
      // scope.skus empty). Each product key is scoped under the vendor key
      // so React state Sets stay collision-free across vendors.
      const subByKey = new Map<string, ProductSubGroup>();
      for (const r of g.results) {
        const extId = r.external_product_id ?? null;
        const subKey = `${g.key}::${extId ?? VENDOR_AGGREGATE_KEY}`;
        let sub = subByKey.get(subKey);
        if (!sub) {
          const productName =
            extId === null
              ? 'Vendor-aggregate'
              : productNameByExtId?.[extId] ?? extId;
          sub = {
            key: subKey,
            externalProductId: extId,
            productName,
            results: [],
          };
          subByKey.set(subKey, sub);
        }
        sub.results.push(r);
      }
      const productSubGroups = Array.from(subByKey.values()).sort((a, b) => {
        // Vendor-aggregate sub-item sorts last so per-SKU rows lead the list
        // when both flavours coexist (shouldn't happen today, but defensive).
        if (a.externalProductId === null && b.externalProductId !== null) return 1;
        if (a.externalProductId !== null && b.externalProductId === null) return -1;
        return a.productName.localeCompare(b.productName);
      });
      return {
        ...g,
        productSubGroups,
        gapTiers: tiers,
        score: scoreOf(tiers),
      };
    });
    list.sort(
      (a, b) =>
        b.score - a.score || a.counterpartyName.localeCompare(b.counterpartyName),
    );
    return list;
  }, [results, productNameByExtId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.counterpartyName.toLowerCase().includes(q));
  }, [groups, query]);

  function toggleVendor(key: string) {
    setVendorExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleProduct(key: string) {
    setProductCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search counterparties…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-slate">
          {filtered.length} of {groups.length} counterparties
        </span>
      </div>
      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {filtered.map((g) => {
          const isVendorOpen = vendorExpanded.has(g.key);
          // Vendor-row chips summarise across ALL the vendor's results
          // (matches the pre-Plan-3 surface) — the per-product detail moves
          // into the product expansion below.
          const hasPLT = g.results.some((r) => r.signal_type === 'published_lead_time');
          const hasQLT = g.results.some((r) => r.signal_type === 'quoted_lead_time');
          const hasLT = g.results.some((r) => r.signal_type === 'lead_time_distribution');
          const hasCAP = g.results.some(
            (r) => r.signal_type === 'capacity_utilization_band',
          );
          const hasDEL = g.results.some((r) => r.signal_type === 'delivery_event');
          return (
            <li key={g.key} className="px-3 py-2">
              <button
                type="button"
                onClick={() => toggleVendor(g.key)}
                aria-expanded={isVendorOpen}
                className="group flex w-full items-center gap-3 text-left"
              >
                <span className="font-medium text-charcoal">{g.counterpartyName}</span>
                <span className="flex items-center gap-1">
                  {hasPLT && <Pill category="signal_type" value="PLT" />}
                  {hasQLT && <Pill category="signal_type" value="QLT" />}
                  {hasLT && <Pill category="signal_type" value="LT" />}
                  {hasCAP && <Pill category="signal_type" value="CAP" />}
                  {hasDEL && <Pill category="signal_type" value="DEL" />}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {g.gapTiers.size > 0 ? (
                    <>
                      <GapTierBar tiers={g.gapTiers} />
                      <ScorePill score={g.score} tiers={g.gapTiers} />
                    </>
                  ) : (
                    <span className="text-xs text-slate">all signals direct</span>
                  )}
                  <DetailChevron expanded={isVendorOpen} />
                </span>
              </button>
              {isVendorOpen && (
                <ul className="mt-3 ml-4 divide-y divide-slate-100">
                  {g.productSubGroups.map((sub) => {
                    const isProductOpen = !productCollapsed.has(sub.key);
                    const cap = sub.results.find(
                      (r) => r.signal_type === 'capacity_utilization_band',
                    );
                    const del = sub.results.find(
                      (r) => r.signal_type === 'delivery_event',
                    );
                    const published = extractNumberedLeadTime(
                      sub.results,
                      'published_lead_time',
                    );
                    const quoted = extractNumberedLeadTime(
                      sub.results,
                      'quoted_lead_time',
                    );
                    const calibrated = extractCalibrated(sub.results);
                    return (
                      <li key={sub.key} className="py-2">
                        <button
                          type="button"
                          onClick={() => toggleProduct(sub.key)}
                          aria-expanded={isProductOpen}
                          className="group flex w-full items-center gap-3 text-left"
                        >
                          <span className="text-charcoal">{sub.productName}</span>
                          <span className="ml-auto">
                            <DetailChevron expanded={isProductOpen} />
                          </span>
                        </button>
                        {isProductOpen && (
                          <div className="mt-2 space-y-3 border-t border-slate-100 pt-2 pl-2">
                            <div>
                              <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                                Lead time
                              </h4>
                              <LeadTimeTriplet
                                published={published}
                                quoted={quoted}
                                calibrated={calibrated}
                              />
                            </div>
                            <div>
                              <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                                Available capacity
                              </h4>
                              <CapacityBandPanel
                                {...(signalRow(cap) as Parameters<
                                  typeof CapacityBandPanel
                                >[0])}
                              />
                            </div>
                            <div>
                              <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                                Delivery events
                              </h4>
                              <DeliveryEventLog
                                {...(signalRow(del) as Parameters<
                                  typeof DeliveryEventLog
                                >[0])}
                              />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
