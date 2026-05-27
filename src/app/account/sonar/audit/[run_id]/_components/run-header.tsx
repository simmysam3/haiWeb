'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AuditRun, RunStatus, RunOrigin } from '@haiwave/protocol';

interface Props {
  run: AuditRun;
}

function formatRunTitle(run: AuditRun): string {
  // template_name is not in the AuditRun protocol type; the BFF enriches it
  // from the linked RunTemplate so the H1 shows the user-given audit name.
  const enriched = run as AuditRun & { template_name?: string | null };
  if (enriched.template_name) return enriched.template_name;
  return `Run ${run.run_id.slice(0, 8)}`;
}

function formatRunReference(run: AuditRun): string {
  return `Run ${run.run_id.slice(0, 8)}`;
}

function formatOriginPrefix(origin: RunOrigin | undefined): string {
  switch (origin) {
    case 'template_manual': return 'Manual';
    case 'template_scheduled': return 'Scheduled';
    case 'template_event_triggered': return 'Event-triggered';
    case 'ad_hoc': return 'Ad-hoc';
    case 'evidence_response': return 'Evidence-response';
    default: return '';
  }
}

function formatCompletionVerb(status: RunStatus): string {
  switch (status) {
    case 'complete': return 'Completed';
    case 'partial': return 'Partially completed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'throttled': return 'Throttled';
    case 'running': return '';
  }
}

function HashCopy({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked in some environments — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Click to copy full hash: ${hash}`}
      className="underline decoration-dotted underline-offset-2 hover:text-navy transition-colors cursor-pointer"
      aria-label={copied ? 'Copied full hash' : 'Copy full result hash'}
    >
      {copied ? 'copied!' : hash.slice(0, 6)}
    </button>
  );
}

export function RunHeader({ run }: Props) {
  const title = formatRunTitle(run);
  const runReference = formatRunReference(run);
  const triggeredAt = new Date(run.triggered_at).toLocaleString();

  const originPrefix = formatOriginPrefix(run.run_origin);
  const completionVerb = formatCompletionVerb(run.status);
  // For cancelled runs the terminal timestamp lives on cancelled_at; every
  // other terminal status uses completed_at.
  const terminalTimeIso = run.status === 'cancelled'
    ? run.cancelled_at ?? run.completed_at
    : run.completed_at;
  const terminalTime = terminalTimeIso ? new Date(terminalTimeIso).toLocaleString() : null;

  // First clause — opener: "{Origin} run started at <time>." or "Run started
  // at <time>." when origin is unknown.
  const opener = originPrefix
    ? `${originPrefix} run started at ${triggeredAt}.`
    : `Run started at ${triggeredAt}.`;

  return (
    <header className="space-y-3">
      {/* Breadcrumb — keeps the short run-id reference visible above the
          audit-name H1 so users can still identify the specific run at a
          glance. */}
      <nav className="flex items-center gap-1 text-xs text-slate" aria-label="Breadcrumb">
        <Link href="/account/sonar/audit" className="hover:text-navy transition-colors">
          Audits
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-charcoal truncate">{runReference}</span>
      </nav>

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-charcoal">{title}</h1>
          {/* One-sentence sub-head replaces the prior pill row. Status + hash
              are folded into the sentence; the footer still carries the full
              canonical Run ID / Hash / timestamps. */}
          <p className="text-xs text-slate">
            {opener}
            {completionVerb && terminalTime && (
              <>
                {' '}
                {completionVerb} at {terminalTime}
                {run.result_hash && (
                  <>
                    {' '}with Hash of <HashCopy hash={run.result_hash} />
                  </>
                )}
                .
              </>
            )}
            {completionVerb && !terminalTime && (
              <>
                {' '}
                {completionVerb}.
              </>
            )}
            {run.error_message && (
              <>
                {' '}
                <span className="text-problem">{run.error_message}</span>
              </>
            )}
          </p>
        </div>

        {/* Edit / Run Again CTA — opens the wizard prefilled from this run;
            user can submit unchanged (re-run) or edit any field first. */}
        <Link
          href={`/account/sonar/audit/new?from_run=${run.run_id}`}
          className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90 transition-colors shrink-0"
        >
          Edit / Run Again
        </Link>
      </div>
    </header>
  );
}
