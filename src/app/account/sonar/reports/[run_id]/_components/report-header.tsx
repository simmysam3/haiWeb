import Link from 'next/link';
import type { AggregateReportHeader, PerVendorReportHeader } from '@/lib/haiwave-api';

type Props =
  | { variant: 'aggregate'; header: AggregateReportHeader }
  | { variant: 'per_vendor'; header: PerVendorReportHeader; runId: string };

export function ReportHeader(props: Props) {
  const { header } = props;
  return (
    <header className="space-y-3">
      {props.variant === 'per_vendor' && (
        <Link
          href={`/account/sonar/reports/${props.runId}`}
          className="inline-block text-xs text-teal hover:text-navy"
        >
          ← Back to aggregate
        </Link>
      )}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl text-navy">
          {props.variant === 'aggregate' ? 'Aggregate report' : 'Per-vendor report'}
        </h1>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-navy/10 text-navy">
          {header.scope_type}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate">
        <dt className="font-medium text-charcoal">Run</dt>
        <dd className="font-mono">{header.run_id.slice(0, 8)}…</dd>
        <dt className="font-medium text-charcoal">Scope</dt>
        <dd>{header.scope_label}</dd>
        <dt className="font-medium text-charcoal">Initiator</dt>
        <dd>{header.initiator_legal_name}</dd>
        {props.variant === 'per_vendor' && (
          <>
            <dt className="font-medium text-charcoal">Vendor</dt>
            <dd>{props.header.vendor_legal_name}</dd>
          </>
        )}
        <dt className="font-medium text-charcoal">Triggered</dt>
        <dd>{new Date(header.triggered_at).toLocaleString()}</dd>
        <dt className="font-medium text-charcoal">Completed</dt>
        <dd>{header.completed_at ? new Date(header.completed_at).toLocaleString() : '—'}</dd>
      </dl>
    </header>
  );
}
