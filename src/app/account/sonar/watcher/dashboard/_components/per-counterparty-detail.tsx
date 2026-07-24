'use client';

import useSWR from 'swr';
import type { WatcherResult, WatcherRun } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { Pill } from '@/components/pill';
import { VerifiedUndisclosedChip } from '@/components/verified-undisclosed-chip';

// Tooltip copy for the synthesis-mode status pill. One-off definitions passed
// via <Pill definition> (there is no shared PILL_DEFINITIONS category for
// synthesis_mode) so the every-badge-is-a-Pill rule holds without a dev warn.
const SYNTHESIS_MODE_DEFINITION: Record<string, string> = {
  direct: 'Observed directly from this counterparty.',
  aggregated_derivative:
    'Derived by aggregating sub-tier observations; no single counterparty identity is exposed.',
  redacted_gap:
    'A sub-tier observation whose identity is withheld — a disclosure gap, not a data failure.',
};

interface PerCounterpartyDetailProps {
  runId: string;
  counterpartyId: string;
  onClose: () => void;
}

interface RunDetailEnvelope {
  run: WatcherRun;
  results: WatcherResult[];
}

/**
 * Drawer for a single counterparty's Watcher results within a run.
 *
 * Renders the full payload (or gap_reason for redacted_gap entries) in
 * a JSON-pretty form per signal_type. v1.28 ships a single-run view;
 * historical comparison across runs is deferred to v1.29 (and a future
 * aggregated endpoint per spec §16.6).
 */
export function PerCounterpartyDetail({ runId, counterpartyId, onClose }: PerCounterpartyDetailProps) {
  const { data, isLoading } = useSWR<RunDetailEnvelope>(
    `/api/account/sonar/watcher/runs/${runId}`,
    jsonFetcher,
  );

  const myResults = (data?.results ?? []).filter(
    (r) => r.counterparty_participant_id === counterpartyId,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-navy/40"
      onClick={onClose}
    >
      <div
        className="bg-white shadow-lg w-full max-w-xl p-6 space-y-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-navy">
            Counterparty {counterpartyId.slice(0, 8)}…
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate hover:text-charcoal"
          >
            ×
          </button>
        </header>

        {isLoading && <p className="text-sm text-slate">Loading…</p>}
        {!isLoading && myResults.length === 0 && (
          <p className="text-sm text-slate italic">No results for this counterparty.</p>
        )}

        {myResults.map((r) => (
          <article
            key={r.result_id}
            className="rounded border border-slate-200 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-charcoal capitalize">
                {r.signal_type.replace(/_/g, ' ')}
              </h4>
              <Pill
                tone={r.synthesis_mode === 'direct' ? 'success' : 'warn'}
                definition={SYNTHESIS_MODE_DEFINITION[r.synthesis_mode]}
              >
                {r.synthesis_mode}
              </Pill>
            </div>
            <p className="text-xs text-slate">
              Observed {new Date(r.observed_at).toLocaleString()}
            </p>
            {r.synthesis_mode === 'redacted_gap' ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <VerifiedUndisclosedChip />
                <span className="text-slate">
                  Gap reason:{' '}
                  <span className="font-mono">{r.gap_reason ?? 'unspecified'}</span>
                </span>
              </div>
            ) : (
              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(r.payload, null, 2)}
              </pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
