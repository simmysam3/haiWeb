'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { Pill } from '@/components/pill';

type ReadinessVerdict = 'ready' | 'at_risk' | 'not_ready' | 'not_evaluated';

interface QueueLastRun {
  run_id: string;
  status: string;
  readiness_verdict: ReadinessVerdict | null;
  created_at: string;
  completed_at: string | null;
}

interface QueueConfig {
  template_id: string;
  template_name: string;
  sku: string | null;
  source: 'own' | 'counterparty';
  counterparty_id: string | null;
  last_run: QueueLastRun | null;
}

interface QueueResponse {
  configs: QueueConfig[];
}

const NEW_HREF = '/account/sonar/templates/new?observation_class=phantom_demand';

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const IN_FLIGHT = new Set(['running', 'in_progress', 'pending', 'queued', 'throttled']);
const COMPLETED = new Set(['complete', 'completed', 'succeeded']);
const FAILED = new Set(['failed', 'cancelled', 'canceled']);

function isInFlight(status: string): boolean {
  return IN_FLIGHT.has(status);
}

function isFailure(status: string): boolean {
  return FAILED.has(status);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const m = Math.floor((Date.now() - then) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PhantomDemandQueue() {
  const { data, error, mutate, isLoading } = useSWR<QueueResponse>(
    '/api/account/sonar/phantom-demand/queue',
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        latest?.configs?.some((c) => c.last_run && isInFlight(c.last_run.status))
          ? 5_000
          : 30_000,
    },
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function clearRuns(templateId: string) {
    if (
      !confirm(
        'Clear all runs for this request? Phantom-demand runs are transitory — the config is kept.',
      )
    ) {
      return;
    }
    setClearingId(templateId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/phantom-demand/runs?template_id=${encodeURIComponent(templateId)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setActionError('Could not clear the run history. Please try again.');
        return;
      }
      await mutate();
    } catch {
      setActionError('Network error — could not clear the run history.');
    } finally {
      setClearingId(null);
    }
  }

  async function rerun(templateId: string) {
    setBusyId(templateId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/templates/${templateId}/trigger`,
        { method: 'POST' },
      );
      if (!res.ok) {
        setActionError('Could not start the run. Please try again.');
        return;
      }
      await mutate();
    } catch {
      setActionError('Network error — could not start the run.');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">Failed to load the Phantom Demand queue.</p>
    );
  }
  if (isLoading || !data) {
    return <p className="text-sm text-slate">Loading…</p>;
  }
  if (data.configs.length === 0) {
    return (
      <div className="rounded border border-dashed p-8 text-center">
        <h2 className="text-base font-semibold text-charcoal">
          Create your first Phantom Demand request
        </h2>
        <p className="mt-1 text-sm text-slate">
          Project hypothetical demand for one of your products (BOM) or a trading
          partner&apos;s SKU — without committing to an order.
        </p>
        <Link
          href={NEW_HREF}
          className="mt-3 inline-block rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal/90"
        >
          New request
        </Link>
      </div>
    );
  }

  const anyInFlight = data.configs.some(
    (c) => c.last_run && isInFlight(c.last_run.status),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {anyInFlight ? (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-sky-900"
          >
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500"
              aria-hidden
            />
            A run is in progress — refreshing every 5s
          </span>
        ) : (
          <span />
        )}
        <Link
          href={NEW_HREF}
          className="rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal/90"
        >
          New request
        </Link>
      </div>

      {actionError && <p className="text-sm text-rose-600">{actionError}</p>}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Request', 'SKU', 'Source', 'Last run', 'Status', ''].map((h, i) => (
                <th
                  key={h || `c${i}`}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.configs.map((c) => {
              const lr = c.last_run;
              const live = !!lr && isInFlight(lr.status);
              const hasOutput = !!lr && COMPLETED.has(lr.status);
              const neverRun = !lr;
              return (
                <tr key={c.template_id} className={live ? 'bg-sky-50/40' : undefined}>
                  <td className="px-4 py-2 text-charcoal">{c.template_name}</td>
                  <td className="px-4 py-2">
                    {c.sku ? (
                      <span className="font-mono text-xs text-charcoal">{c.sku}</span>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {c.source === 'counterparty' ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
                        title="Supplier SKU — single-item direct probe of a trading partner"
                      >
                        Supplier · SKU
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        title="Internal — your own product, exploded via its BOM"
                      >
                        Internal · BOM
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-charcoal"
                    title={lr ? new Date(lr.created_at).toLocaleString() : undefined}
                  >
                    {lr ? formatRelative(lr.created_at) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {!lr ? (
                      <span className="text-xs italic text-slate">never run</span>
                    ) : isFailure(lr.status) ? (
                      <Pill
                        tone="problem"
                        definition="The run ended before producing a readiness outcome."
                      >
                        {lr.status === 'failed' ? 'Failed' : 'Cancelled'}
                      </Pill>
                    ) : lr.readiness_verdict &&
                      lr.readiness_verdict !== 'not_evaluated' ? (
                      <Pill category="readiness" value={lr.readiness_verdict} />
                    ) : (
                      <span
                        className="text-xs text-slate"
                        title="No readiness outcome yet"
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => rerun(c.template_id)}
                        disabled={busyId === c.template_id}
                        className="text-teal hover:underline disabled:opacity-50"
                      >
                        {busyId === c.template_id
                          ? 'Starting…'
                          : neverRun
                            ? '↻ Run'
                            : '↻ Re-run'}
                      </button>
                      <Link
                        href={`/account/sonar/templates/${c.template_id}`}
                        className="text-teal hover:underline"
                      >
                        Config
                      </Link>
                      {live ? (
                        <span
                          role="status"
                          aria-live="polite"
                          className="inline-flex items-center gap-1.5 text-sky-800"
                          title="Run in progress — output appears when it completes"
                        >
                          <span
                            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600"
                            aria-hidden
                          />
                          Running…
                        </span>
                      ) : hasOutput ? (
                        <Link
                          href={`/account/sonar/phantom-demand/runs/${lr.run_id}`}
                          className="text-teal hover:underline"
                        >
                          Output ›
                        </Link>
                      ) : (
                        <span
                          className="text-slate/50"
                          title="Output appears once a run completes"
                        >
                          Output ›
                        </span>
                      )}
                      {lr && (
                        <button
                          type="button"
                          onClick={() => clearRuns(c.template_id)}
                          disabled={clearingId === c.template_id}
                          aria-label="Clear run history"
                          title="Clear run history — PD runs are transitory; the config is kept"
                          className="text-slate hover:text-rose-600 disabled:opacity-50"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate">
        Internal rows explode your product&apos;s BOM; Supplier rows probe one
        partner SKU directly.
      </p>
    </div>
  );
}
