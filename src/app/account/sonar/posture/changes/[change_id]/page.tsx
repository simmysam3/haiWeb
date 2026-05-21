import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ComplianceChangeDetail } from '@haiwave/protocol';
import { ChangeDetailCompare } from './change-detail-compare';
import { PageIntro } from '@/components/page-intro';
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
      href="/account/sonar/posture/changes"
      className="inline-flex items-center gap-1 text-sm text-teal hover:text-navy"
    >
      ← Back to Changes
    </Link>
  );

  if (result.kind === 'error') {
    // haiCore returns 404 for unknown id or cross-initiator access; treat as not-found.
    if (result.status === 404) notFound();

    return (
      <div className="px-8 py-10">
        {backLink}
        <div
          role="alert"
          className="mt-8 rounded-lg border border-slate/20 bg-white p-12 text-center"
        >
          <p className="text-red-900">
            {result.status === 403
              ? 'You do not have permission to view this change.'
              : result.status === 401
              ? 'Your session has expired. Please sign in again.'
              : result.status >= 500
              ? "Couldn't load this change. The audit service is temporarily unavailable."
              : result.status === 0
              ? `Couldn't reach the audit service${result.message ? `: ${result.message}` : '.'}`
              : `Couldn't load this change (status ${result.status}).`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-10">
      <header className="mb-4">
        {backLink}
        <h1 className="mt-4 text-3xl font-display text-navy">Change detail</h1>
      </header>
      <PageIntro>
        Side-by-side view of the compliance cell state before and after this change was detected. Samples are attribute observations captured at snapshot time; the subtree shows the raw supply-chain node data when available.
      </PageIntro>

      <ChangeDetailCompare detail={result.data} />
    </div>
  );
}
