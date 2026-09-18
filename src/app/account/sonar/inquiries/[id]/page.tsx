import { notFound } from 'next/navigation';
import { isPending } from '@haiwave/protocol';
import { fetchBffJson } from '@/lib/server-fetch';
import { INQUIRY_NOT_ENABLED_MESSAGE, type InquiryDetailResponse } from '@/lib/safe-room-types';

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await fetchBffJson<InquiryDetailResponse>(`/api/account/sonar/inquiries/${id}`);
  if (result.kind === 'error') notFound();
  const inq = result.data;

  // PF P15 (Q3): the BFF's mapping of the upstream 403 — scope, not-yours and no-such-inquiry alike.
  if ('not_enabled' in inq) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry</h1>
        <p className="rounded-md border border-slate/15 bg-light-gray px-4 py-3 text-sm text-slate">{INQUIRY_NOT_ENABLED_MESSAGE}</p>
      </div>
    );
  }

  if (isPending(inq)) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
        <p className="text-sm text-slate">This inquiry is still pending a response.</p>
      </div>
    );
  }

  // PF P16: the silent member is `.strict()` with three keys — every decline is byte-equal (spec §1.4),
  // so there is nothing else to show and reading an answered-only field here would render `undefined`.
  if (!('commitment' in inq)) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
        <p className="text-sm text-charcoal">{inq.outcome}</p>
        <p className="text-xs text-slate">Every decline is returned in one fixed shape, so no reason is available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-slate">Outcome</dt><dd className="text-charcoal">{inq.outcome}</dd></div>
        <div><dt className="text-slate">Form answered</dt><dd className="text-charcoal">{inq.form_answered}</dd></div>
        <div><dt className="text-slate">Commitment</dt><dd className="text-charcoal font-mono text-xs">{inq.commitment.commitment_id}</dd></div>
        <div><dt className="text-slate">Basis</dt><dd className="text-charcoal">{inq.basis}</dd></div>
        <div><dt className="text-slate">Granularity</dt><dd className="text-charcoal">{inq.granularity}</dd></div>
      </dl>
      {/* PF P17 — no Value panel: a re-read is ALWAYS qualified (D-222). */}
      <p className="text-xs text-slate">Re-reads are always served in qualified form: the raw value exists only in the synchronous response to the inquiry itself and is never persisted.</p>
      {inq.condition && <div className="rounded-md border border-slate/15 bg-light-gray p-4 text-sm text-charcoal">Condition: {JSON.stringify(inq.condition)}</div>}
      <div className="rounded-md border border-slate/15 bg-light-gray p-4 text-sm text-charcoal font-mono text-xs">Signed at {inq.commitment.signed_at}</div>
    </div>
  );
}
