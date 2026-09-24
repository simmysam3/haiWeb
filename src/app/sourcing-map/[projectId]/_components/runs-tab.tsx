'use client';
import Link from 'next/link';
import type { SmRunListResponse } from '@/lib/sourcing-map/contract';
import { smRunHref } from '@/lib/sourcing-map/routes';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

type Run = SmRunListResponse['runs'][number];
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** Floor, so 99.6% never reads as 100% (a covered-in-full claim). */
function pct(ratio: number): string {
  return `${Math.floor(ratio * 100 + 1e-9)}%`;
}

/** The Runs tab (spec §7.1). Cycle 22.4 adds "+ New run" and delete. */
export function RunsTab({ projectId, initialRuns }: { projectId: string; initialRuns: Run[] }) {
  return (
    <div>
      <table className="sm-table">
        <thead>
          <tr><th>Run</th><th>Products</th><th>Last execution</th><th>Portfolio coverage</th><th>Status</th></tr>
        </thead>
        <tbody>
          {initialRuns.map((r) => {
            const last = r.last_execution;
            return (
              <tr key={r.template_id} aria-label={r.template_name}>
                <td>
                  <Link href={smRunHref(projectId, r.template_id)} aria-label={`Open ${r.template_name}`} className="group inline-flex items-center gap-2">
                    {r.template_name}
                    <DetailChevron />
                  </Link>
                </td>
                <td>{r.product_count}</td>
                <td>{last?.started_at ? DATE.format(new Date(last.started_at)) : 'Never run'}</td>
                <td>{last?.portfolio_coverage_last_drop != null ? pct(last.portfolio_coverage_last_drop) : '—'}</td>
                <td>{last ? <Pill themed category="sm_execution_status" value={last.status} detail={last.failure_reason} /> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
