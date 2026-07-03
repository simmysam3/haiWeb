'use client';

import { useMemo, useState } from 'react';
import type { WatcherResult, WatcherSynthesisMode } from '@haiwave/protocol';
import {
  DetailChevron,
  GapTierBar,
  ScorePill,
  tierBucket,
  tierPoints,
  tierLabel,
  tierStyle,
  scoreOf,
} from '@/components/sonar/observations';
import { Pill } from '@/components/pill';
import { LeadTimeTriplet, type Numbered, type Distribution } from './lead-time-triplet';
import { CapacityBandPanel } from './capacity-band-panel';
import { DeliveryEventLog } from './delivery-event-log';

// Page-enriched shape — watchers/[id]/page.tsx joins in counterparty_name
// client-side (WatcherResult only carries the participant id) before handing
// results to this component.
export type EnrichedWatcherResult = WatcherResult & { counterparty_name?: string | null };

interface Props {
  results: EnrichedWatcherResult[];
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

function nameOf(r: EnrichedWatcherResult): string {
  // Sub-tier aggregate rows: identity is intentionally null (tier-2+ rollups).
  if (r.counterparty_participant_id === null) return 'Identity withheld';
  // Direct tier-1 rows: prefer the page-enriched counterparty_name; fall back
  // to the canonical "Vendor Name Not Disclosed" framing used elsewhere
  // (e.g. tree-view) rather than exposing a raw UUID slice.
  return r.counterparty_name ?? 'Vendor Name Not Disclosed';
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

// The three lead-time signals roll up into one "Lead time" panel.
const LEAD_TIME_SIGNALS = [
  'lead_time_distribution',
  'published_lead_time',
  'quoted_lead_time',
] as const;

// Disclosure-gap contribution for one product + signal group, mirroring the
// vendor-level scoreOf math (tierPoints summed over redacted gaps) scoped to a
// single row. Lets each section header show what it adds to the vendor's
// follow-up-priority score, tying the upper-right number to the rows below.
function gapContribution(
  results: WatcherResult[],
  signalTypes: readonly string[],
): { tier: number; points: number } | null {
  let tier: number | null = null;
  let points = 0;
  for (const r of results) {
    if (signalTypes.includes(r.signal_type) && r.synthesis_mode === 'redacted_gap') {
      const t = tierBucket(r.tier);
      tier = tier === null ? t : Math.min(tier, t);
      points += tierPoints(t);
    }
  }
  return tier === null ? null : { tier, points };
}

function GapChip({ tier, points }: { tier: number; points: number }) {
  const st = tierStyle(tier);
  return (
    <span
      className={`ml-1.5 inline-flex items-baseline gap-1 rounded px-1 py-0.5 text-[9px] font-semibold normal-case tracking-normal ${st.bg} ${st.text}`}
      title={`Disclosure gap at tier ${tierLabel(tier)} — adds +${points} to this vendor's follow-up priority score`}
    >
      gap · T{tierLabel(tier)} · +{points}
    </span>
  );
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

// Generic over the panel's own Props shape (via `Parameters<typeof Panel>[0]`
// at the call site) so callers get back an already-typed value instead of
// wrapping the call in a local `as Parameters<typeof Panel>[0]` cast — the
// one unavoidable cast (WatcherResult['payload'] is `unknown` at the
// protocol level; each panel narrows it per synthesis_mode) lives here once.
function signalRow<P extends { synthesisMode: WatcherSynthesisMode; payload: unknown }>(
  r: WatcherResult | undefined,
): P {
  if (!r) return { synthesisMode: 'redacted_gap', payload: null } as P;
  return { synthesisMode: r.synthesis_mode, payload: r.payload } as P;
}

export function CounterpartiesGrid({ results, productNameByExtId }: Props) {
  const [query, setQuery] = useState('');
  const [vendorExpanded, setVendorExpanded] = useState<Set<string>>(new Set());

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
                <ul className="mt-1.5 ml-4 divide-y divide-slate-100">
                  {g.productSubGroups.map((sub) => {
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
                    // Which signals on this product are disclosure gaps, and
                    // what each contributes to the vendor's score.
                    const ltGap = gapContribution(sub.results, LEAD_TIME_SIGNALS);
                    const capGap = gapContribution(sub.results, [
                      'capacity_utilization_band',
                    ]);
                    const delGap = gapContribution(sub.results, ['delivery_event']);
                    // Products are always shown under an expanded vendor — the
                    // company row is the only collapse level. Each product is a
                    // compact label followed by its three signal panels laid out
                    // in columns to keep the row dense.
                    return (
                      <li key={sub.key} className="py-1.5">
                        <div className="text-sm font-medium text-charcoal">
                          {sub.productName}
                        </div>
                        <div className="mt-1 grid gap-x-6 gap-y-1.5 md:grid-cols-3">
                          <div>
                            <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                              Lead time
                              {ltGap && <GapChip tier={ltGap.tier} points={ltGap.points} />}
                            </h4>
                            <LeadTimeTriplet
                              published={published}
                              quoted={quoted}
                              calibrated={calibrated}
                            />
                          </div>
                          <div>
                            <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                              Available capacity
                              {capGap && <GapChip tier={capGap.tier} points={capGap.points} />}
                            </h4>
                            <CapacityBandPanel
                              {...signalRow<Parameters<typeof CapacityBandPanel>[0]>(cap)}
                            />
                          </div>
                          <div>
                            <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                              Delivery events
                              {delGap && <GapChip tier={delGap.tier} points={delGap.points} />}
                            </h4>
                            <DeliveryEventLog
                              {...signalRow<Parameters<typeof DeliveryEventLog>[0]>(del)}
                            />
                          </div>
                        </div>
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
