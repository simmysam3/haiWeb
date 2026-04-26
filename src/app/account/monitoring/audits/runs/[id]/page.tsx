import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { RollupPanel } from './rollup-panel';
import { ProductsGrid } from './products-grid';

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
        <h1 className="text-xl font-semibold text-charcoal">
          Run {data.run.run_id.slice(0, 8)}
        </h1>
        <p className="text-sm text-slate">
          {new Date(data.run.triggered_at).toLocaleString()} · status{' '}
          {data.run.status} · {data.results.length}{' '}
          {data.results.length === 1 ? 'product' : 'products'} ·{' '}
          {data.run.gap_count ?? 0} gaps
        </p>
      </header>

      <RollupPanel results={data.results} />

      <section>
        <h2 className="text-sm font-medium text-charcoal mb-2">Products</h2>
        <ProductsGrid results={data.results} />
      </section>
    </div>
  );
}
