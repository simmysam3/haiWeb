'use client';

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import type { ComplianceChange, ComplianceChangeOutcome } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { IdChip } from '@/components/id-chip';
import { describeChange, kindLabel, severityTone } from '@/app/account/sonar/_lib/describe-change';

interface Props {
  changes: ComplianceChange[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// Outcome enum -> short human label, mirrors the OutcomeForm dropdown.
// Surfaced inline on the row so the user can see what they decided without
// opening the detail page.
const OUTCOME_LABEL: Record<ComplianceChangeOutcome, string> = {
  tier1_acceptable: 'Tier 1 acceptable',
  tier2_adverse: 'Tier 2 adverse',
  replacement_supplier: 'Replacement supplier',
  exemption_temporary_90d: 'Temporary exemption',
  exemption_permanent: 'Permanent exemption',
  other: 'Other outcome',
};

export function ChangesFeed({ changes, total, page = 1, pageSize }: Props) {
  // Empty state handles two cases:
  //   - no matches at all (total == 0 → suggest broadening filters)
  //   - paged past the end (total > 0 but this page is empty → suggest page 1)
  if (changes.length === 0) {
    const pagedPastEnd = total !== undefined && total > 0 && page > 1;
    return (
      <p className="p-12 text-center text-slate">
        {pagedPastEnd
          ? `No events on page ${page} — only ${total} match the current filters.`
          : 'No changes in the selected window.'}
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate/10">
      {changes.map((change) => {
        const description = describeChange(change);
        const detectedAt = new Date(change.detected_at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        const isProcessed = change.processed_at != null;
        const processedAt = change.processed_at
          ? new Date(change.processed_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : null;
        const outcomeLabel = change.processed_outcome
          ? OUTCOME_LABEL[change.processed_outcome]
          : null;

        return (
          <div
            key={change.change_id}
            className={`flex items-start justify-between gap-4 px-4 py-4 ${
              isProcessed ? 'bg-slate-50/60' : ''
            }`}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill
                  category="change_kind"
                  value={change.change_kind}
                  tone={severityTone(change.severity)}
                >
                  {kindLabel(change.change_kind)}
                </Pill>
                <Pill
                  category="severity"
                  value={change.severity}
                  tone={severityTone(change.severity)}
                />
                {isProcessed && (
                  <span
                    title={
                      processedAt
                        ? `Processed at ${processedAt}${outcomeLabel ? ` — ${outcomeLabel}` : ''}`
                        : 'Processed'
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-slate/30 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate"
                  >
                    Processed
                    {outcomeLabel && (
                      <span className="font-normal normal-case tracking-normal text-charcoal">
                        · {outcomeLabel}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p
                className={`text-sm font-medium ${
                  isProcessed ? 'text-slate' : 'text-navy'
                }`}
              >
                {change.vendor_legal_name ? (
                  <span title={change.vendor_participant_id}>{change.vendor_legal_name}</span>
                ) : (
                  <IdChip id={change.vendor_participant_id} />
                )}
                {change.component_ref ? (
                  <span className="ml-1 font-normal text-slate">· {change.component_ref}</span>
                ) : null}
              </p>
              <p data-testid="change-description" className="text-sm text-slate">{description}</p>
              <p className="text-xs text-slate/70">
                {detectedAt}
                {isProcessed && processedAt && (
                  <span className="ml-2">· Processed {processedAt}</span>
                )}
              </p>
            </div>
            <ProcessAction change={change} />
          </div>
        );
      })}
      {total !== undefined && pageSize !== undefined && total > pageSize && (
        <Pager total={total} page={page} pageSize={pageSize} rowsOnPage={changes.length} />
      )}
    </div>
  );
}

/**
 * Per-row CTA on the Events feed. Two visual states keyed off
 * `change.processed_at`:
 *  - null → filled teal `Process` link to the detail page, where the
 *    user picks an outcome and commits.
 *  - not null → outlined slate Link labelled `Processed`, same target.
 */
function ProcessAction({ change }: { change: ComplianceChange }) {
  const detailHref = `/account/sonar/audit/events/${change.change_id}`;
  if (change.processed_at != null) {
    return (
      <Link
        href={detailHref}
        className="shrink-0 rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy"
      >
        Processed
      </Link>
    );
  }
  return (
    <Link
      href={detailHref}
      className="shrink-0 rounded-md border border-teal bg-teal px-3 py-1.5 text-xs text-white hover:bg-teal/90"
    >
      Process
    </Link>
  );
}

interface PagerProps {
  total: number;
  page: number;
  pageSize: number;
  rowsOnPage: number;
}

/**
 * Renders a footer with "Showing X–Y of Z" and prev/next page links. Builds
 * each link by mutating the live URL's `page` param so kind/partner/from/to
 * filters survive page changes. Uses Next `<Link>` so navigation is client-
 * side (no full reload) but the page param is still in the URL on share/reload.
 */
function Pager({ total, page, pageSize, rowsOnPage }: PagerProps) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = (page - 1) * pageSize + rowsOnPage;

  const hrefForPage = (target: number) => {
    const next = new URLSearchParams(sp.toString());
    if (target <= 1) next.delete('page');
    else next.set('page', String(target));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const prevEnabled = page > 1;
  const nextEnabled = page < lastPage;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-xs text-slate/80">
      <p>
        Showing {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        {prevEnabled ? (
          <Link
            href={hrefForPage(page - 1)}
            className="rounded-md border border-slate/30 px-2 py-1 hover:border-teal hover:text-navy"
          >
            ‹ Prev
          </Link>
        ) : (
          <span className="rounded-md border border-slate/15 px-2 py-1 text-slate/40">‹ Prev</span>
        )}
        <span className="px-2">Page {page} of {lastPage}</span>
        {nextEnabled ? (
          <Link
            href={hrefForPage(page + 1)}
            className="rounded-md border border-slate/30 px-2 py-1 hover:border-teal hover:text-navy"
          >
            Next ›
          </Link>
        ) : (
          <span className="rounded-md border border-slate/15 px-2 py-1 text-slate/40">Next ›</span>
        )}
      </div>
    </div>
  );
}
