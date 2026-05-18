import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPerVendorReport } from './_lib/load-per-vendor-report';
import { ReportHeader } from '../../_components/report-header';
import { CoverageSummary } from '../../_components/coverage-summary';
import { SkuTable } from '../../_components/sku-table';
import { GapDetail } from '../../_components/gap-detail';
import { ReportFooter } from '../../_components/report-footer';
import { ComplianceReservedFooter } from '../../_components/compliance-reserved-footer';
import { DownloadMenu } from '../../_components/download-menu';

export default async function PerVendorReportPage({
  params,
}: {
  params: Promise<{ run_id: string; vendor_id: string }>;
}) {
  const { run_id, vendor_id } = await params;
  const result = await loadPerVendorReport(run_id, vendor_id);

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
        <ReportHeader variant="per_vendor" header={report.header} runId={run_id} />
        <DownloadMenu runId={run_id} reportType="per_vendor" vendorId={vendor_id} />
      </div>
      <CoverageSummary summary={report.coverage_summary} />
      <SkuTable rows={report.sku_table} />
      <GapDetail entries={report.gap_detail} />
      <ComplianceReservedFooter />
      <ReportFooter footer={report.footer} />
    </div>
  );
}
