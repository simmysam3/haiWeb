'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SM_LIMITS, type SmRunListResponse, type SmRunTemplate } from '@/lib/sourcing-map/contract';
import { smRunHref } from '@/lib/sourcing-map/routes';
import { smFetch } from '@/lib/sourcing-map/client';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { DispositionDialog, type Disposition } from '../../_components/disposition-dialog';

type Run = SmRunListResponse['runs'][number];
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** Floor, so 99.6% never reads as 100% (a covered-in-full claim). */
function pct(ratio: number): string {
  return `${Math.floor(ratio * 100 + 1e-9)}%`;
}

/** The Runs tab (spec §7.1): runs, "+ New run" and delete with the D-206 disposition (AC 19). */
export function RunsTab({ projectId, initialRuns }: { projectId: string; initialRuns: Run[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
  const [deleting, setDeleting] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function newRun() {
    setBusy(true);
    setError(null);
    const out = await smFetch<{ template: SmRunTemplate }>('/api/account/sourcing-map/runs', {
      method: 'POST',
      body: {
        template_name: `Run ${runs.length + 1}`,
        scope: { kind: 'sourcing_map', project_id: projectId, products: [], depth_cap: SM_LIMITS.DEPTH_CAP_DEFAULT, seat_weekly_capacity: null },
      },
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    router.push(smRunHref(projectId, out.data.template.template_id));
  }

  // Contract §10 "delete": a delete during an execution answers 409 execution_in_progress for
  // every disposition; the message is shown as haiCore wrote it, and no code is special-cased.
  async function remove(r: Run, d: Disposition) {
    setBusy(true);
    setError(null);
    const out = await smFetch(`/api/account/sourcing-map/runs/${r.template_id}?runs=${d}`, { method: 'DELETE' });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setRuns((all) => all.filter((x) => x.template_id !== r.template_id));
    setDeleting(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="sm-heading text-lg font-semibold">Runs</h2>
        <button type="button" className="sm-btn sm-btn-primary" disabled={busy} onClick={newRun}>+ New run</button>
      </div>
      {error && !deleting && <p role="alert" className="sm-error mb-3 text-sm">{error}</p>}
      <table className="sm-table">
        <thead>
          <tr><th>Run</th><th>Products</th><th>Last execution</th><th>Portfolio coverage</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {runs.map((r) => {
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
                <td>
                  <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Delete ${r.template_name}`} onClick={() => { setError(null); setDeleting(r); }}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {deleting && (
        <DispositionDialog
          key={deleting.template_id}
          open
          title={`Delete ${deleting.template_name}`}
          onCancel={() => { setDeleting(null); setError(null); }}
          onConfirm={(d) => void remove(deleting, d)}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}
