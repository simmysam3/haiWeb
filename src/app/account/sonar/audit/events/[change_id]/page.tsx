import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ComplianceChangeDetail } from '@haiwave/protocol';
import { ChangeDetailCompare } from '@/app/account/sonar/_components/change-detail-compare';
import { describeAuditServiceError } from '../_lib/describe-audit-service-error';
import { OutcomeForm } from './outcome-form';
import { PageIntro } from '@/components/page-intro';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';

async function fetchChangeDetail(changeId: string) {
  return fetchBffJson<ComplianceChangeDetail>(
    `/api/account/sonar/compliance/changes/${encodeURIComponent(changeId)}`,
  );
}

interface PageProps {
  params: Promise<{ change_id: string }>;
}

export default async function ChangeDetailPage({ params }: PageProps) {
  const { change_id } = await params;
  const result = await fetchChangeDetail(change_id);

  const backLink = (
    <Link
      href="/account/sonar/audit/events"
      className="inline-flex items-center gap-1 text-sm text-teal hover:text-navy"
    >
      ← Back to Events
    </Link>
  );

  if (result.kind === 'error') {
    // haiCore returns 404 for unknown id or cross-initiator access; treat as not-found.
    if (result.status === 404) notFound();

    return (
      <div>
        {backLink}
        <div
          role="alert"
          className="mt-8 rounded-lg border border-slate/20 bg-white p-12 text-center"
        >
          <p className="text-red-900">
            {describeAuditServiceError(result, 'this event')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Events" title="Event detail" />
      <PageIntro>
        Side-by-side view of the cell state before and after this event was detected. Samples are attribute observations captured at snapshot time; the subtree shows the raw supply-chain node data when available.
      </PageIntro>

      <div className="space-y-2">
        {backLink}
        <ChangeDetailCompare
          detail={result.data}
          outcomeForm={<OutcomeForm change={result.data.change} />}
        />
      </div>
    </div>
  );
}
