import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PhantomDemandAggregateReport } from '@haiwave/protocol';
import { DownloadMenu } from './_components/download-menu';
import { PageIntro } from '@/components/page-intro';
import { PageHeader } from '@/components';

type LoadResult =
  | { kind: 'ok'; report: PhantomDemandAggregateReport }
  | { kind: 'error'; status: number }
  | { kind: 'network-error' };

async function loadAggregateReport(windowId: string): Promise<LoadResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/phantom-demand/reports/${windowId}/aggregate`;

  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    const report = (await res.json()) as PhantomDemandAggregateReport;
    return { kind: 'ok', report };
  } catch (err) {
    console.error('[loadPhantomDemandAggregateReport] network failure', { windowId, err });
    return { kind: 'network-error' };
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default async function PhantomDemandAggregateReportPage({
  params,
}: {
  params: Promise<{ window_id: string }>;
}) {
  const { window_id } = await params;
  const result = await loadAggregateReport(window_id);

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
      <PageHeader
        eyebrow="Phantom Demand"
        title="Aggregate report"
        description={
          <>
            Window {report.header.window_id.slice(0, 8)} (
            {report.header.window_days} days). Generated{' '}
            {new Date(report.header.generated_at).toLocaleString()}.{' '}
            {report.header.counterparty_count} counterparties probed.
          </>
        }
        actions={
          <DownloadMenu windowId={report.header.window_id} reportType="aggregate" />
        }
      />

      <PageIntro>
        The persistent, exportable report for each phantom-demand window — aggregate availability, per-counterparty breakdown, and gap classification, available as HTML, JSON, CSV, or PDF. Use these reports for procurement reviews, stakeholder updates, and audit trails; the live signal lives in <em>Phantom Demand</em>.
      </PageIntro>

      <section>
        <h2 className="text-lg font-medium text-navy">Posture summary</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Total probes</div>
            <div className="mt-1 text-2xl font-semibold text-navy">
              {report.posture_summary.total_probes}
            </div>
          </div>
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Response rate</div>
            <div className="mt-1 text-2xl font-semibold text-success">
              {pct(report.posture_summary.response_rate)}
            </div>
          </div>
          <div className="rounded-md border border-slate/20 bg-light-gray/40 p-4">
            <div className="text-xs uppercase tracking-wide text-slate">Median latency</div>
            <div className="mt-1 text-2xl font-semibold text-cobalt">
              {report.posture_summary.median_response_latency_ms.toFixed(0)} ms
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-navy">Per-counterparty</h2>
        {report.per_counterparty_summary.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate">
            No counterparties were probed during this window.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="bg-light-gray/40 text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-3 py-2">Counterparty</th>
                <th className="px-3 py-2 text-right">Probes</th>
                <th className="px-3 py-2 text-right">Response rate</th>
                <th className="px-3 py-2 text-right">Median latency</th>
                <th className="px-3 py-2 text-right">Behavioral score</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {report.per_counterparty_summary.map((r) => (
                <tr key={r.counterparty_participant_id} className="border-b border-slate/10">
                  <td className="px-3 py-2 text-charcoal">{r.counterparty_display_name}</td>
                  <td className="px-3 py-2 text-right text-charcoal">{r.probe_count}</td>
                  <td className="px-3 py-2 text-right text-charcoal">{pct(r.response_rate)}</td>
                  <td className="px-3 py-2 text-right text-charcoal">
                    {r.median_response_latency_ms.toFixed(0)} ms
                  </td>
                  <td className="px-3 py-2 text-right text-charcoal">
                    {r.behavioral_signal_score !== null
                      ? r.behavioral_signal_score.toFixed(2)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className="text-teal hover:text-navy"
                      href={`/account/sonar/phantom-demand/reports/${report.header.window_id}/counterparty/${r.counterparty_participant_id}`}
                    >
                      View
                    </Link>
                  </td>
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
