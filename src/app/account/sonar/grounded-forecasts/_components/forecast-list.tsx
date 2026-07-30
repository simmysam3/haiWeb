'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { RunTemplate } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { describeApiError } from '@/lib/api-error';
import { Pill } from '@/components/pill';
// Deep imports, not the observations barrel: the barrel also re-exports the
// column-pack/table modules, which are server-side by construction. This is a
// client component, so pulling the barrel would drag them across that boundary
// — invisible to vitest and tsc, but real at build time.
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { formatRelative } from '@/components/sonar/observations/format';

const LIST_HREF = '/api/account/sonar/grounded-forecasts';
export const NEW_FORECAST_HREF = '/account/sonar/grounded-forecasts/new';

interface ListResponse {
  templates: RunTemplate[];
}

// The BFF already filters, but the payload's type is the full RunTemplate
// union — narrowing here is what lets the row read `scope.product_name`, and
// it keeps the page honest if the upstream filter is ever relaxed.
type ForecastTemplate = Extract<RunTemplate, { observation_class: 'grounded_forecast' }>;
function isForecastTemplate(t: RunTemplate): t is ForecastTemplate {
  return t.observation_class === 'grounded_forecast';
}

/**
 * "100,000/mo · 2027-01 → 2027-12" — the whole demand profile as one phrase.
 * The locale is pinned: an unqualified toLocaleString() groups digits
 * differently per environment, which would make the column drift between a
 * developer's machine and CI for no user-visible reason.
 */
function formatProfile(profile: ForecastTemplate['scope']['profile']): string {
  return `${profile.monthly_qty.toLocaleString('en-US')}/mo · ${profile.start_month} → ${profile.end_month}`;
}

export function ForecastList() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(LIST_HREF, jsonFetcher);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runNow(templateId: string) {
    setBusyId(templateId);
    setActionError(null);
    try {
      const res = await fetch(`/api/account/sonar/templates/${templateId}/trigger`, {
        method: 'POST',
      });
      if (!res.ok) {
        setActionError((await describeApiError(res)).message);
        setBusyId(null);
        return;
      }
      // A grounded forecast keeps only its latest result, keyed by template —
      // there is no per-run address to land on, so the run opens the forecast
      // itself and that page polls the run to completion.
      router.push(`/account/sonar/grounded-forecasts/${templateId}`);
    } catch {
      setActionError('Network error — could not start the run.');
      setBusyId(null);
    }
  }

  async function deleteForecast(templateId: string) {
    setBusyId(templateId);
    setActionError(null);
    try {
      const res = await fetch(`/api/account/sonar/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setActionError((await describeApiError(res)).message);
        return;
      }
      setConfirmingId(null);
      await mutate();
    } catch {
      setActionError('Network error — could not delete the forecast.');
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <p className="text-sm text-rose-600">Failed to load your grounded forecasts.</p>;
  }
  if (isLoading || !data) {
    return <p className="text-sm text-slate">Loading…</p>;
  }

  const forecasts = data.templates.filter(isForecastTemplate);

  if (forecasts.length === 0) {
    return (
      <div className="rounded border border-dashed p-8 text-center">
        <h2 className="text-base font-semibold text-charcoal">
          Create your first grounded forecast
        </h2>
        <p className="mt-1 text-sm text-slate">
          Name a product you have not built yet, nominate the predecessors it
          resembles, and get back a dated commitment schedule — what to order,
          in what quantity, by when.
        </p>
        <Link
          href={NEW_FORECAST_HREF}
          className="mt-3 inline-block rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal/90"
        >
          New forecast
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link
          href={NEW_FORECAST_HREF}
          className="rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal/90"
        >
          New forecast
        </Link>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-rose-600">
          {actionError}
        </p>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Forecast', 'Product', 'Demand profile', 'Last run', ''].map((h, i) => (
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
            {forecasts.map((t) => {
              const armed = confirmingId === t.template_id;
              const busy = busyId === t.template_id;
              return (
                <tr key={t.template_id}>
                  <td className="px-4 py-2 text-charcoal">{t.template_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-charcoal">
                    {t.scope.product_name}
                  </td>
                  <td className="px-4 py-2 text-xs text-charcoal">
                    {formatProfile(t.scope.profile)}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-charcoal"
                    title={t.last_run_at ? new Date(t.last_run_at).toLocaleString() : undefined}
                  >
                    {t.last_run_at ? (
                      formatRelative(t.last_run_at)
                    ) : (
                      <Pill
                        tone="neutral"
                        definition="This forecast has never been run — no commitment schedule exists yet."
                      >
                        Never run
                      </Pill>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {armed ? (
                      // Inline confirmation, deliberately not window.confirm():
                      // a native dialog is unstyled, unreachable to the page's
                      // own error surface, and untestable without stubbing the
                      // browser.
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <span className="text-charcoal">
                          Delete &ldquo;{t.template_name}&rdquo;? The saved
                          configuration and its latest result go with it.
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteForecast(t.template_id)}
                          disabled={busy}
                          className="font-medium text-rose-600 hover:underline disabled:opacity-50"
                        >
                          {busy ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="text-slate hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => runNow(t.template_id)}
                          disabled={busy}
                          className="text-teal hover:underline disabled:opacity-50"
                        >
                          {busy ? 'Starting…' : 'Run now'}
                        </button>
                        <Link
                          href={`/account/sonar/templates/${t.template_id}`}
                          className="text-teal hover:underline"
                        >
                          Configure
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirmingId(t.template_id);
                          }}
                          className="text-slate hover:text-rose-600"
                        >
                          Delete
                        </button>
                        <Link
                          href={`/account/sonar/grounded-forecasts/${t.template_id}`}
                          className="group inline-flex items-center gap-1.5 text-teal hover:underline"
                        >
                          View
                          <DetailChevron />
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
