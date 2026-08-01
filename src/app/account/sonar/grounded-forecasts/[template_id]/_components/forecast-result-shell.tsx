'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { GroundedForecastResult } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { Pill } from '@/components/pill';
import { renderCommitmentSchedule } from '../../_lib/render-commitment-schedule';
import { ScheduleGrid } from './schedule-grid';

// v1.62 — the forecast result page's client shell. Two-tier polling per the
// PD run-detail precedent: while the template's latest run is not covered by
// the stored result, poll the cheap /status route at 1.5s; fetch the heavy
// result document once the run completes. A failed run leaves the previous
// good result on screen (the run service never prunes on failure).

export interface ForecastResultEnvelope {
  result: GroundedForecastResult;
  run_id: string;
  last_run_at: string;
}

interface Props {
  templateId: string;
  lastRunId: string | null;
  initialResult: ForecastResultEnvelope | null;
}

interface RunStatusResponse {
  status: string;
  cancel_requested_at: string | null;
}

const TERMINAL_STATUSES = new Set(['complete', 'failed', 'cancelled']);
const STATUS_POLL_MS = 1500;

function CopyArtifactButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked in some environments — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied commitment schedule' : 'Copy commitment schedule'}
      className="shrink-0 rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal/90 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ResultBody({ envelope }: { envelope: ForecastResultEnvelope }) {
  // Prepared-on is the day the text leaves this screen — the viewer's today
  // (UTC), not the run date — so past-due day counts age with the artifact.
  const preparedOn = new Date().toISOString().slice(0, 10);
  const artifact = renderCommitmentSchedule(envelope.result, preparedOn);

  return (
    <>
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold text-charcoal">Commitment schedule</h2>
            <p className="text-xs text-slate">
              Generated {new Date(envelope.result.generated_at).toLocaleString()} — copy and
              send to the brand as-is.
            </p>
          </div>
          <CopyArtifactButton text={artifact} />
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-charcoal">
          {artifact}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-charcoal">Working view</h2>
        <ScheduleGrid result={envelope.result} />
      </section>
    </>
  );
}

export function ForecastResultShell({ templateId, lastRunId, initialResult }: Props) {
  // The template points at a run the stored result does not cover — either a
  // run in flight right now, or one that ended without producing a result.
  const trackedRunId =
    lastRunId !== null && initialResult?.run_id !== lastRunId ? lastRunId : null;

  // Tier 1 — cheap status poll. The refreshInterval function stops the poll on
  // a terminal status without dropping the key (the terminal payload decides
  // what happens next).
  const { data: statusData } = useSWR<RunStatusResponse>(
    trackedRunId
      ? `/api/account/sonar/grounded-forecasts/runs/${trackedRunId}/status`
      : null,
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        latest !== undefined && TERMINAL_STATUSES.has(latest.status) ? 0 : STATUS_POLL_MS,
    },
  );

  // Tier 2 — the heavy result document, fetched once the tracked run completes.
  const { data: refreshed } = useSWR<ForecastResultEnvelope>(
    trackedRunId && statusData?.status === 'complete'
      ? `/api/account/sonar/grounded-forecasts/${templateId}/result`
      : null,
    jsonFetcher,
  );

  const envelope = refreshed ?? initialResult;
  const runFailed =
    statusData !== undefined &&
    (statusData.status === 'failed' || statusData.status === 'cancelled');
  // Covered = what we are showing IS the template's latest run.
  const covered =
    envelope !== null && (lastRunId === null || envelope.run_id === lastRunId);
  const running = trackedRunId !== null && !runFailed && !covered;

  return (
    <div className="space-y-4">
      {running && (
        <div className="flex items-center gap-2 rounded border border-slate-200 bg-white p-4">
          <Pill category="run_status" value="running" />
          <p className="text-sm text-slate">
            Run in progress — grounding the forecast against live quotes and delivery
            history…
            {envelope && ' The previous result is shown below until it completes.'}
          </p>
        </div>
      )}

      {runFailed && (
        <div className="flex items-center gap-2 rounded border border-slate-200 bg-white p-4">
          <Pill category="run_status" value={statusData?.status ?? 'failed'} />
          <p className="text-sm text-slate">
            {envelope
              ? 'The latest run did not complete — showing the most recent successful result below.'
              : 'The latest run did not complete. Run the forecast again from the list.'}
          </p>
        </div>
      )}

      {envelope ? (
        <ResultBody envelope={envelope} />
      ) : (
        !running &&
        !runFailed && (
          <div className="rounded border border-dashed p-8 text-center">
            <p className="text-sm text-slate">
              This forecast has not been run yet — run it from the list to generate its
              commitment schedule.
            </p>
          </div>
        )
      )}
    </div>
  );
}
