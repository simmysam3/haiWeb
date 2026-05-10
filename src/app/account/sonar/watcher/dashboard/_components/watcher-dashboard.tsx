'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { WatcherRun } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { RunHistory } from './run-history';
import { LatestSnapshot } from './latest-snapshot';
import { TriggerModal } from './trigger-modal';
import { PerCounterpartyDetail } from './per-counterparty-detail';

interface WatcherRunsEnvelope {
  runs: WatcherRun[];
}

/**
 * Top-level interactive Watcher dashboard. SWR-driven; polls every 5s
 * while at least one run is in flight so status pills + the latest
 * snapshot grid update without manual refresh.
 */
export function WatcherDashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{
    runId: string;
    counterpartyId: string;
  } | null>(null);

  const { data, isLoading, mutate } = useSWR<WatcherRunsEnvelope>(
    '/api/account/sonar/watcher/runs',
    jsonFetcher,
    {
      // 5s while running, off when idle. SWR re-evaluates on each render.
      refreshInterval: (latest) =>
        (latest?.runs ?? []).some((r) => r.status === 'running') ? 5000 : 0,
    },
  );
  const runs = data?.runs ?? [];
  const latestComplete = runs.find(
    (r) => r.status === 'complete' || r.status === 'partial',
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-teal text-white px-4 py-2 text-sm font-medium hover:bg-teal/90 transition-colors"
        >
          Run Watcher observation
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-slate">Loading runs…</p>
      )}

      {!isLoading && latestComplete && (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy mb-3">
            Latest snapshot
          </h2>
          <LatestSnapshot
            runId={latestComplete.run_id}
            onSelectCounterparty={(counterpartyId) =>
              setSelectedDetail({ runId: latestComplete.run_id, counterpartyId })
            }
          />
        </section>
      )}

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy mb-3">
          Run history
        </h2>
        <RunHistory runs={runs} onCancel={() => mutate()} />
      </section>

      {modalOpen && (
        <TriggerModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            void mutate();
          }}
        />
      )}

      {selectedDetail && (
        <PerCounterpartyDetail
          runId={selectedDetail.runId}
          counterpartyId={selectedDetail.counterpartyId}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
