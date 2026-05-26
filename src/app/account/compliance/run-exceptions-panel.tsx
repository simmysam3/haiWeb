'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuditException, AuditExceptionsResponse } from '@haiwave/protocol';
import { Card } from '@/components/card';
import { GroupedAccordion, AccordionGroupRow } from '@/components/grouped-accordion';

/**
 * v.1.41 Audit Exceptions — "Run exceptions" tab.
 *
 * Latest non-compliant audit result per (vendor, product) within the last
 * 7 days. Sourced from /api/account/sonar/audit/exceptions which proxies
 * AuditReportService.listRecentExceptions in haiCore.
 *
 * Each row is clickable and drills into the audit run that produced the
 * exception, so the user can inspect the evidence tree without leaving the
 * exceptions surface as their starting point.
 */

interface Props {
  onCountChange?: (count: number) => void;
}

const FALLBACK: AuditExceptionsResponse = { exceptions: [], window_days: 7 };

function ageDays(triggeredAt: string): string {
  const ms = Date.now() - new Date(triggeredAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function statusLabel(status: AuditException['compliance_status']): {
  text: string;
  className: string;
} {
  if (status === 'non_compliant') {
    return { text: 'Non-compliant', className: 'bg-problem/10 text-problem' };
  }
  return { text: 'Partial', className: 'bg-amber-100 text-amber-800' };
}

export interface VendorGroup {
  vendorId: string;
  vendorName: string;
  issues: AuditException[];
}

/**
 * Group flat audit exceptions by vendor for the accordion view. Sort by
 * issue count desc with vendor name as the stable tiebreaker. Exported so
 * the unit test can exercise it without rendering the component.
 */
export function groupByVendor(exceptions: AuditException[]): VendorGroup[] {
  const map = new Map<string, VendorGroup>();
  for (const e of exceptions) {
    const existing = map.get(e.vendor_id);
    if (existing) {
      existing.issues.push(e);
    } else {
      map.set(e.vendor_id, {
        vendorId: e.vendor_id,
        vendorName: e.vendor_legal_name ?? e.vendor_id,
        issues: [e],
      });
    }
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
    return a.vendorName.localeCompare(b.vendorName);
  });
  return groups;
}

export function RunExceptionsPanel({ onCountChange }: Props) {
  const router = useRouter();
  const [data, setData] = useState<AuditExceptionsResponse>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(vendorId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/sonar/audit/exceptions');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as AuditExceptionsResponse;
        if (cancelled) return;
        setData(body);
        onCountChange?.(body.exceptions.length);
      } catch {
        if (!cancelled) setError('Could not load audit exceptions. Try again in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onCountChange]);

  return (
    <Card>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-navy">
          Non-compliant results from your recent audits
        </h2>
        <p className="text-xs text-slate mt-1">
          Grouped by counterparty — expand a vendor to see each affected product. One issue per
          (vendor, product) pair where the latest audit run within the past {data.window_days}{' '}
          days returned gaps or non-compliant status. Click a row to open the run that detected it.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-problem/20 bg-problem/5 px-3 py-2 text-sm text-problem mb-4"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate py-8 text-center italic">Loading…</p>
      ) : data.exceptions.length === 0 ? (
        <div className="rounded border border-slate/20 bg-slate/5 px-3 py-6 text-sm text-center text-charcoal">
          No exceptions in the last {data.window_days} days. Either every recent audit was
          clean, or you haven&apos;t run any audits yet —{' '}
          <a className="text-teal underline" href="/account/sonar/audit/new">
            start a new audit
          </a>
          .
        </div>
      ) : (
        <GroupedAccordion>
          {groupByVendor(data.exceptions).map((group) => (
            <AccordionGroupRow
              key={group.vendorId}
              groupKey={group.vendorId}
              label={group.vendorName}
              count={group.issues.length}
              expanded={expanded.has(group.vendorId)}
              onToggle={() => toggle(group.vendorId)}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate border-b border-slate/15">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Last run</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Issues</th>
                    <th className="pb-2 font-medium text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {group.issues.map((e) => {
                    const status = statusLabel(e.compliance_status);
                    return (
                      <tr
                        key={`${e.vendor_id}|${e.product_id}|${e.run_id}`}
                        className="group border-b border-slate/10 hover:bg-slate/5 cursor-pointer"
                        onClick={() => router.push(`/account/sonar/audit/${e.run_id}`)}
                      >
                        <td className="py-2 text-charcoal font-mono text-xs truncate max-w-[14ch]">
                          {e.product_id}
                        </td>
                        <td className="py-2 text-slate">{ageDays(e.triggered_at)}</td>
                        <td className="py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.className}`}
                          >
                            {status.text}
                          </span>
                        </td>
                        <td className="py-2 text-charcoal text-xs">
                          {e.gap_count > 0
                            ? `${e.gap_count} gap${e.gap_count === 1 ? '' : 's'}${
                                e.gap_kinds.length > 0 ? ` — ${e.gap_kinds.join(', ')}` : ''
                              }`
                            : '—'}
                        </td>
                        <td className="py-2 pl-4 pr-3 text-right">
                          <span
                            aria-hidden="true"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal/10 text-teal transition-colors group-hover:bg-teal/20"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="9 6 15 12 9 18" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AccordionGroupRow>
          ))}
        </GroupedAccordion>
      )}
    </Card>
  );
}
