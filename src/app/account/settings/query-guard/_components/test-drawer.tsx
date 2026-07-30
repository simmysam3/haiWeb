'use client';

import { useState } from 'react';
import type {
  QueryGuardAction,
  QueryGuardOrigin,
  QueryGuardRuleType,
  QueryGuardTestResult,
  QueryGuardWindow,
  TrustClass,
} from '@haiwave/protocol';
import { Button, Drawer } from '@/components';
import { TRUST_CLASSES } from './guard-rules-matrix';

const ORIGINS: QueryGuardOrigin[] = ['ad_hoc', 'scheduled'];
const WINDOWS: QueryGuardWindow[] = ['hour', 'day', 'week'];

const RULE_TYPE_LABEL: Record<QueryGuardRuleType, string> = {
  sku_repeat: 'sku_repeat',
  sku_breadth: 'sku_breadth',
  ad_hoc_cap: 'ad_hoc_cap',
  excess_volume: 'excess_volume',
};

function describeAction(action: QueryGuardAction): string {
  if (action.type === 'alert') {
    return action.email === null ? 'alert (in-app)' : `alert ${action.email}`;
  }
  if (action.type === 'pause') return `pause ${action.duration_minutes} min`;
  return action.type;
}

/**
 * Dry-run drawer for the query-guard page: the operator enters a
 * hypothetical activity shape (trust class + origin + window + three counts)
 * and sees which rules would trip and what actions would fire, without any
 * enforcement side effects. POSTs to the BFF test route; number inputs use
 * the raw-string pattern so a cleared field doesn't snap back mid-edit.
 */
export function TestDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [trustClass, setTrustClass] = useState<TrustClass>('unknown');
  const [origin, setOrigin] = useState<QueryGuardOrigin>('ad_hoc');
  const [windowValue, setWindow] = useState<QueryGuardWindow>('day');
  const [rawSingleSku, setRawSingleSku] = useState('0');
  const [rawDistinctSkus, setRawDistinctSkus] = useState('0');
  const [rawAdHocRequests, setRawAdHocRequests] = useState('0');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QueryGuardTestResult['results'] | null>(null);

  function parseCount(raw: string): number | null {
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  const singleSku = parseCount(rawSingleSku);
  const distinctSkus = parseCount(rawDistinctSkus);
  const adHocRequests = parseCount(rawAdHocRequests);
  const canRun = singleSku !== null && distinctSkus !== null && adHocRequests !== null && !running;

  async function runTest(): Promise<void> {
    if (singleSku === null || distinctSkus === null || adHocRequests === null) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/account/query-guard/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trust_class: trustClass,
          origin,
          window: windowValue,
          max_queries_single_sku: singleSku,
          distinct_skus: distinctSkus,
          ad_hoc_requests: adHocRequests,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Test failed (${res.status}): ${text}`);
      }
      const payload = (await res.json()) as QueryGuardTestResult;
      setResults(Array.isArray(payload.results) ? payload.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Test rules">
      <div className="space-y-5">
        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Trust class
          </span>
          <select
            value={trustClass}
            onChange={(e) => setTrustClass(e.target.value as TrustClass)}
            aria-label="Trust class"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {TRUST_CLASSES.map((tc) => (
              <option key={tc} value={tc}>
                {tc}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Origin
          </span>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value as QueryGuardOrigin)}
            aria-label="Origin"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Window
          </span>
          <select
            value={windowValue}
            onChange={(e) => setWindow(e.target.value as QueryGuardWindow)}
            aria-label="Window"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Max queries for one SKU
          </span>
          <input
            type="number"
            min={0}
            value={rawSingleSku}
            onChange={(e) => setRawSingleSku(e.target.value)}
            aria-label="Max queries for one SKU"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Distinct SKUs
          </span>
          <input
            type="number"
            min={0}
            value={rawDistinctSkus}
            onChange={(e) => setRawDistinctSkus(e.target.value)}
            aria-label="Distinct SKUs"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Ad-hoc requests
          </span>
          <input
            type="number"
            min={0}
            value={rawAdHocRequests}
            onChange={(e) => setRawAdHocRequests(e.target.value)}
            aria-label="Ad-hoc requests"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>

        <div className="flex justify-end pt-3 border-t border-slate/15">
          <Button onClick={() => runTest()} disabled={!canRun}>
            {running ? 'Running…' : 'Run test'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-problem" role="alert">
            {error}
          </p>
        )}

        {results !== null && (
          <ul className="space-y-3">
            {results.map((result) => (
              <li
                key={result.rule_type}
                className="rounded-md border border-slate/15 p-3 text-sm"
              >
                <span className="block font-medium text-charcoal">
                  {RULE_TYPE_LABEL[result.rule_type]}
                </span>
                {result.would_trip ? (
                  <span className="mt-1 block text-problem">
                    Would trip — {result.observed} &gt; {result.threshold}
                  </span>
                ) : (
                  <span className="mt-1 block text-slate">Within limits</span>
                )}
                {result.would_trip && result.actions.length > 0 && (
                  <span className="mt-1 block text-xs text-slate">
                    Actions: {result.actions.map(describeAction).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
