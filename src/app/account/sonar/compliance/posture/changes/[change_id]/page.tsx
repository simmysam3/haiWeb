import Link from 'next/link';
import { headers } from 'next/headers';
import type { ComplianceChangeDetail } from '@haiwave/protocol';
import { ChangeDetailCompare } from './change-detail-compare';
import { PageIntro } from '@/components/page-intro';

type FetchResult =
  | { kind: 'ok'; data: ComplianceChangeDetail }
  | { kind: 'error'; status: number };

async function fetchChangeDetail(changeId: string): Promise<FetchResult> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/changes/${encodeURIComponent(changeId)}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', data: (await res.json()) as ComplianceChangeDetail };
  } catch {
    return { kind: 'error', status: 0 };
  }
}

interface PageProps {
  params: Promise<{ change_id: string }>;
}

export default async function ChangeDetailPage({ params }: PageProps) {
  const { change_id } = await params;
  const result = await fetchChangeDetail(change_id);

  const backLink = (
    <Link
      href="/account/sonar/compliance/posture/changes"
      className="inline-flex items-center gap-1 text-sm text-teal hover:text-navy"
    >
      ← Back to Changes
    </Link>
  );

  if (result.kind === 'error') {
    return (
      <div className="px-8 py-10">
        {backLink}
        <div className="mt-8 rounded-lg border border-slate/20 bg-white p-12 text-center">
          <p className="text-red-900">
            Could not load this change{result.status > 0 ? ` (status ${result.status})` : ''}.
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
