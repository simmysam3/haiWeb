'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pill } from '@/components/pill';
import type { AuditRun } from '@haiwave/protocol';

interface Props {
  run: AuditRun;
}

function formatRunTitle(run: AuditRun): string {
  // template_name is not in the AuditRun protocol type; the BFF may enrich it.
  const enriched = run as AuditRun & { template_name?: string | null };
  if (enriched.template_name) return enriched.template_name;
  return `Run ${run.run_id.slice(0, 8)}`;
}

function HashChip({ hash }: { hash: string }) {
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
      className="font-mono text-xs text-slate hover:text-navy transition-colors cursor-pointer"
      aria-label={copied ? 'Copied full hash' : 'Copy full result hash'}
    >
      {copied ? 'copied!' : hash.slice(0, 6)}
    </button>
  );
}

export function RunHeader({ run }: Props) {
  const title = formatRunTitle(run);
  const triggeredAt = new Date(run.triggered_at).toLocaleString();

  return (
    <header className="space-y-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate" aria-label="Breadcrumb">
        <Link href="/account/sonar/audit" className="hover:text-navy transition-colors">
          Audits
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-charcoal truncate">{title}</span>
      </nav>

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-charcoal">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
            <span title={triggeredAt}>Run at {triggeredAt}</span>
          </div>
        </div>

        {/* Run again CTA */}
        <Link
          href={`/account/sonar/audit/new?from_run=${run.run_id}`}
          className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90 transition-colors shrink-0"
        >
          Run again
        </Link>
      </div>

      {/* Pill row: status, origin, result_hash */}
      <div className="flex flex-wrap items-center gap-2">
        <Pill
          category="run_status"
          value={run.status}
          detail={run.error_message ?? undefined}
        />
        {run.run_origin && (
          <Pill category="run_origin" value={run.run_origin} />
        )}
        {run.result_hash && (
          <span className="flex items-center gap-1 text-xs text-slate">
            <span className="font-semibold uppercase tracking-wide text-[10px]">Hash</span>
            <HashChip hash={run.result_hash} />
          </span>
        )}
      </div>
    </header>
  );
}
