'use client';

import { useMemo, useState } from 'react';
import type { WatcherResult, WatcherSynthesisMode } from '@haiwave/protocol';
import {
  GapTierBar,
  ScorePill,
  tierBucket,
  scoreOf,
} from '@/components/sonar/observations';
import { Pill } from '@/components/pill';
import { LeadTimePanel } from './lead-time-panel';
import { CapacityBandPanel } from './capacity-band-panel';
import { DeliveryEventLog } from './delivery-event-log';

interface Props {
  results: WatcherResult[];
}

interface CounterpartyGroup {
  key: string;
  counterpartyId: string | null;
  counterpartyName: string;
  results: WatcherResult[];
  gapTiers: Map<number, number>;
  score: number;
}

function nameOf(r: WatcherResult): string {
  if (r.counterparty_participant_id === null) return 'Identity withheld';
  const named = (r as WatcherResult & { counterparty_name?: string | null })
    .counterparty_name;
  return named ?? `Counterparty ${r.counterparty_participant_id?.slice(0, 8)}`;
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

export function CounterpartiesGrid({ results }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
          gapTiers: new Map(),
          score: 0,
        };
        byKey.set(key, g);
      }
      g.results.push(r);
    }
    const list = Array.from(byKey.values()).map((g) => {
      const tiers = gapTiersFor(g.results);
      return { ...g, gapTiers: tiers, score: scoreOf(tiers) };
    });
    list.sort(
      (a, b) =>
        b.score - a.score || a.counterpartyName.localeCompare(b.counterpartyName),
    );
    return list;
  }, [results]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.counterpartyName.toLowerCase().includes(q));
  }, [groups, query]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function signalRow(r: WatcherResult | undefined): {
    synthesisMode: WatcherSynthesisMode;
    payload: unknown;
  } {
    if (!r) return { synthesisMode: 'redacted_gap', payload: null };
    return { synthesisMode: r.synthesis_mode, payload: r.payload };
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
          const isOpen = expanded.has(g.key);
          const lt = g.results.find(
            (r) => r.signal_type === 'lead_time_distribution',
          );
          const cap = g.results.find(
            (r) => r.signal_type === 'capacity_utilization_band',
          );
          const del = g.results.find((r) => r.signal_type === 'delivery_event');
          return (
            <li key={g.key} className="px-3 py-2">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="font-medium text-charcoal">{g.counterpartyName}</span>
                <span className="flex items-center gap-1">
                  {lt && <Pill category="signal_type" value="LT" />}
                  {cap && <Pill category="signal_type" value="CAP" />}
                  {del && <Pill category="signal_type" value="DEL" />}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <GapTierBar tiers={g.gapTiers} />
                  <ScorePill score={g.score} tiers={g.gapTiers} />
                  <span className="text-teal text-lg font-bold">
                    {isOpen ? '⌄' : '›'}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <div>
                    <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                      Lead time
                    </h4>
                    <LeadTimePanel
                      {...(signalRow(lt) as Parameters<typeof LeadTimePanel>[0])}
                    />
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                      Capacity
                    </h4>
                    <CapacityBandPanel
                      {...(signalRow(cap) as Parameters<typeof CapacityBandPanel>[0])}
                    />
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs uppercase tracking-wider text-slate">
                      Delivery events
                    </h4>
                    <DeliveryEventLog
                      {...(signalRow(del) as Parameters<typeof DeliveryEventLog>[0])}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
