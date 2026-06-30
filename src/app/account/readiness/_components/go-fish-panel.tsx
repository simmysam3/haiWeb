'use client';

import { useState, useCallback } from 'react';
import { Pill } from '@/components/pill';
import { partitionGoFish } from '../_lib/partition-gofish';
import type { BacklogItem, GoFishAggregatedResponse } from '@haiwave/protocol';

type GoFishResultItem = GoFishAggregatedResponse['results'][number];

type GoFishPanelProps = {
  item: BacklogItem;
  onResolved?: () => void;
};

type PanelState =
  | { phase: 'idle' }
  | { phase: 'searching'; queryId: string }
  | { phase: 'results'; results: GoFishAggregatedResponse }
  | { phase: 'error'; message: string };

async function pollGoFish(queryId: string): Promise<GoFishAggregatedResponse> {
  const MAX_POLLS = 30;
  const INTERVAL_MS = 2000;
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`/api/account/readiness/gofish/${queryId}`);
    if (!res.ok) throw new Error(`gofish poll failed: HTTP ${res.status}`);
    const data = (await res.json()) as GoFishAggregatedResponse;
    if (data.resolved_at !== null) return data;
    await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  throw new Error('Go Fish query timed out');
}

export function GoFishPanel({ item, onResolved }: GoFishPanelProps) {
  const [state, setState] = useState<PanelState>({ phase: 'idle' });

  const handleSearch = useCallback(async () => {
    const queryId = crypto.randomUUID();
    setState({ phase: 'searching', queryId });
    try {
      const postRes = await fetch('/api/account/readiness/gofish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_id: queryId,
          query_text: item.event.color_code,
          filters: {
            min_quantity: item.event.needed?.amount,
            max_lead_time_days: undefined,
          },
        }),
      });
      if (!postRes.ok) throw new Error(`Go Fish initiation failed: HTTP ${postRes.status}`);
      const data = await pollGoFish(queryId);
      setState({ phase: 'results', results: data });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [item]);

  async function handleInitiate(result: GoFishResultItem) {
    try {
      // The state machine forbids open → resolved directly.
      // Drive through the legal path: open → acknowledged → resolved.
      if (item.state === 'open') {
        const ackRes = await fetch(
          `/api/account/readiness/backlog/${item.backlog_item_id}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_state: 'acknowledged' }),
          },
        );
        if (!ackRes.ok) throw new Error(`Acknowledge failed: HTTP ${ackRes.status}`);
      }
      const res = await fetch(
        `/api/account/readiness/backlog/${item.backlog_item_id}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_state: 'resolved' }),
        },
      );
      if (!res.ok) throw new Error(`Resolve failed: HTTP ${res.status}`);
      onResolved?.();
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed to resolve item',
      });
    }
    // Suppress unused variable warning — result is available for future detail display
    void result;
  }

  return (
    <div className="space-y-3">
      {state.phase === 'idle' && (
        <button
          onClick={() => void handleSearch()}
          className="rounded px-3 py-1.5 text-xs font-medium bg-teal/10 text-teal-dark hover:bg-teal/20 transition-colors"
        >
          Find Alternative Source
        </button>
      )}

      {state.phase === 'searching' && (
        <p className="text-xs text-slate animate-pulse">
          Searching the HAIWAVE network…
        </p>
      )}

      {state.phase === 'error' && (
        <div role="alert" className="text-xs text-problem">
          {state.message}
        </div>
      )}

      {state.phase === 'results' && (() => {
        const { existing, newSource } = partitionGoFish(state.results.results);
        return (
          <div className="space-y-4">
            {existing.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-navy uppercase tracking-wide">
                  Existing Relationships
                </h4>
                {existing.map((r) => (
                  <div
                    key={r.participant_id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate/20 bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-charcoal truncate">
                        {r.participant_name}
                      </span>
                      {r.relationship_state && (
                        <Pill category="status" value={r.relationship_state} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate">
                        {r.offering.quantity_available.toLocaleString()} units ·{' '}
                        {r.offering.lead_time_days}d
                      </span>
                      <button
                        onClick={() => void handleInitiate(r)}
                        className="rounded px-2 py-1 text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        Initiate
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {newSource.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-navy uppercase tracking-wide">
                  New Sources
                </h4>
                {newSource.map((r) => (
                  <div
                    key={r.participant_id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate/20 bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-charcoal truncate">
                        {r.participant_name}
                      </span>
                      <Pill category="status" value="none" />
                    </div>
                    <span className="text-xs text-slate shrink-0">
                      {r.offering.quantity_available.toLocaleString()} units ·{' '}
                      {r.offering.lead_time_days}d
                    </span>
                  </div>
                ))}
              </section>
            )}

            {existing.length === 0 && newSource.length === 0 && (
              <p className="text-xs text-slate">
                No available sources found for this component.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
