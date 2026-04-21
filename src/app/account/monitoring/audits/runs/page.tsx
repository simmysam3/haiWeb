import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import type { AuditRun } from '@haiwave/protocol';

async function loadRuns(): Promise<AuditRun[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/account/audit-runs?limit=100`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { runs?: AuditRun[] };
    return data.runs ?? [];
  } catch {
    return [];
  }
}

export default async function RunsPage() {
  const runs = await loadRuns();
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">Runs</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-slate border-b border-slate/10">
          <tr>
            <th className="pb-2">Triggered</th>
            <th>Products</th>
            <th>Gaps</th>
            <th>Hops</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const productCount = r.scope_snapshot.resolved_products.length;
            const durMs = r.completed_at
              ? new Date(r.completed_at).getTime() -
                new Date(r.triggered_at).getTime()
              : null;
            return (
              <tr key={r.run_id} className="border-b border-slate/5">
                <td className="py-2">
                  <Link
                    className="text-teal underline"
                    href={`/account/monitoring/audits/runs/${r.run_id}`}
                  >
                    {new Date(r.triggered_at).toLocaleString()}
                  </Link>
                </td>
                <td>{productCount}</td>
                <td>{r.gap_count ?? '—'}</td>
                <td>{r.hop_count ?? '—'}</td>
                <td>{durMs !== null ? `${(durMs / 1000).toFixed(1)}s` : '—'}</td>
                <td>{r.status}</td>
              </tr>
            );
          })}
          {runs.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-slate text-center">
                No runs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
