import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadAggregateReport } from './_lib/load-report';
import { ReportHeader } from './_components/report-header';
import { PostureSummary } from './_components/posture-summary';
import { GeographicRollup } from './_components/geographic-rollup';
import { ClassRollup } from './_components/class-rollup';
import { GapInventory } from './_components/gap-inventory';
import { PerVendorSummary } from './_components/per-vendor-summary';
import { ReportFooter } from './_components/report-footer';
import { ComplianceReservedFooter } from './_components/compliance-reserved-footer';
import { DownloadMenu } from './_components/download-menu';

export default async function AggregateReportPage({
  params,
}: {
  params: Promise<{ run_id: string }>;
}) {
  const { run_id } = await params;
  const result = await loadAggregateReport(run_id);

  if (result.kind === 'error' && result.status === 404) {
    notFound();
  }

  if (result.kind === 'error' || result.kind === 'network-error') {
    return (
      <div className="px-8 py-10">
        <div className="rounded-md border border-problem/20 bg-problem/5 p-6 text-sm text-problem">
          Couldn&apos;t load this report. The audit service is temporarily unavailable.
        </div>
      </div>
    );
  }

  const { report } = result;

  if (report.header.completed_at === null) {
    return (
      <div className="px-8 py-10 space-y-3">
        <p className="text-sm text-slate">
          Report not yet available — this run is still running.
        </p>
        <Link
          href={`/account/sonar/audit/runs/${run_id}`}
          className="text-teal hover:text-navy text-sm"
        >
          Back to run detail
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-10 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <ReportHeader variant="aggregate" header={report.header} />
        <DownloadMenu runId={run_id} reportType="aggregate" />
      </div>
      <PostureSummary summary={report.posture_summary} />
      <GeographicRollup rows={report.geographic_rollup} />
      <ClassRollup rows={report.class_rollup} />
      <GapInventory entries={report.gap_inventory} />
      <PerVendorSummary rows={report.per_vendor_summary} runId={run_id} />
      <ComplianceReservedFooter />
      <ReportFooter footer={report.footer} />
    </div>
  );
}
