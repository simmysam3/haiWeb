import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { PhantomDemandPerCounterpartyReport } from '@haiwave/protocol';
import { DownloadMenu } from '../../_components/download-menu';

type LoadResult =
  | { kind: 'ok'; report: PhantomDemandPerCounterpartyReport }
  | { kind: 'error'; status: number }
  | { kind: 'network-error' };

async function loadPerCounterpartyReport(
  windowId: string,
  counterpartyId: string,
): Promise<LoadResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/phantom-demand/reports/${windowId}/counterparty/${counterpartyId}`;

  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    const report = (await res.json()) as PhantomDemandPerCounterpartyReport;
    return { kind: 'ok', report };
  } catch (err) {
    console.error('[loadPhantomDemandPerCounterpartyReport] network failure', {
      windowId,
      counterpartyId,
      err,
    });
    return { kind: 'network-error' };
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function PhantomDemandPerCounterpartyReportPage({
  params,
}: {
  params: Promise<{ window_id: string; counterparty_id: string }>;
}) {
  const { window_id, counterparty_id } = await params;
  const result = await loadPerCounterpartyReport(window_id, counterparty_id);

  if (result.kind === 'error' && result.status === 404) {
    notFound();
  }

  if (result.kind === 'error' || result.kind === 'network-error') {
    return (
      <div className="px-8 py-10">
        <div className="rounded-md border border-problem/20 bg-problem/5 p-6 text-sm text-problem">
          Couldn&apos;t load this report. The phantom demand service is temporarily unavailable.
        </div>
      </div>
    );
  }

  const { report } = result;

  return (
    <div className="px-8 py-10 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            Phantom demand — {report.header.counterparty_display_name}
          </h1>
          <p className="mt-1 text-sm text-slate">
            Window {report.header.window_id.slice(0, 8)} ({report.header.window_days} days).
            Generated {new Date(report.header.generated_at).toLocaleString()}.
          </p>
        </div>
        <DownloadMenu
          windowId={report.header.window_id}
          reportType="per_counterparty"
          counterpartyId={report.header.counterparty_participant_id}
        />
      </div>

      <section>
        <h2 className="text-lg font-medium text-navy">Coverage summary</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Probes</div>
            <div className="mt-1 text-2xl font-semibold text-navy">
              {report.coverage_summary.probe_count}
            </div>
          </div>
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Response rate</div>
            <div className="mt-1 text-2xl font-semibold text-success">
              {pct(report.coverage_summary.response_rate)}
            </div>
          </div>
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Median latency</div>
            <div className="mt-1 text-2xl font-semibold text-cobalt">
              {report.coverage_summary.median_response_latency_ms.toFixed(0)} ms
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-navy">Probe history</h2>
        {report.probe_history.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate">
            No probes recorded for this counterparty in this window.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="bg-light-gray/40 text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-3 py-2">Probed at</th>
                <th className="px-3 py-2">Responded at</th>
                <th className="px-3 py-2 text-right">Latency</th>
                <th className="px-3 py-2">Capacity band</th>
              </tr>
            </thead>
            <tbody>
              {report.probe_history.map((p) => (
                <tr key={p.probe_id} className="border-b border-slate/10">
                  <td className="px-3 py-2 text-charcoal">
                    {new Date(p.probed_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-charcoal">
                    {p.responded_at ? new Date(p.responded_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-charcoal">
                    {p.response_latency_ms !== null
                      ? `${p.response_latency_ms.toFixed(0)} ms`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-charcoal">{p.capacity_band_at_probe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="border-t border-slate/10 pt-4 text-xs italic text-light-slate">
        [Compliance-reserved] Fields transformation_chain, lot_batch_lineage, and
        temporal_validity_window are defined in the report schema (spec §6.5) and will be
        populated in a future release. They are not yet rendered in this report.
      </div>
    </div>
  );
}
