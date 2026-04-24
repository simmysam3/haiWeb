import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { TreeView } from './tree-view';
import { RollupPanel } from './rollup-panel';
import { IdChip } from '@/components/id-chip';

async function load(
  runId: string,
): Promise<{ run: AuditRun; results: AuditRunResult[] } | null> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  try {
    const runRes = await fetch(`${baseUrl}/api/account/audit-runs/${runId}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!runRes.ok) return null;
    const run = (await runRes.json()) as AuditRun;
    if (!run?.run_id) return null;

    const resultsRes = await fetch(
      `${baseUrl}/api/account/audit-runs/${runId}/results`,
      {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      },
    );
    const resultsData = resultsRes.ok
      ? ((await resultsRes.json()) as { results?: AuditRunResult[] })
      : { results: [] };

    return { run, results: resultsData.results ?? [] };
  } catch {
    return null;
  }
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Run {id}</h1>
        <p className="text-sm text-slate">
          {new Date(data.run.triggered_at).toLocaleString()} · status{' '}
          {data.run.status} · {data.results.length} products ·{' '}
          {data.run.gap_count ?? 0} gaps
        </p>
      </header>
      <RollupPanel results={data.results} />
      <section>
        <h2 className="text-sm font-medium text-charcoal mb-2">
          Per-product trees
        </h2>
        <div className="space-y-2">
          {data.results.map((r) => (
            <div
              key={r.result_id}
              className="rounded border border-slate/10 bg-layer-1 p-3"
            >
              <div className="mb-3 flex items-baseline gap-4 flex-wrap pb-2 border-b border-slate/10">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate">Product</div>
                  <div className="text-sm font-mono text-charcoal">{r.product_id}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate">Vendor</div>
                  {r.tree.vendor_legal_name ? (
                    <div className="text-sm text-charcoal">{r.tree.vendor_legal_name}</div>
                  ) : (
                    <IdChip id={r.vendor_participant_id} />
                  )}
                </div>
              </div>
              <TreeView node={r.tree} />
            </div>
          ))}
          {data.results.length === 0 && (
            <p className="text-sm text-slate">No results for this run.</p>
          )}
        </div>
      </section>
    </div>
  );
}
