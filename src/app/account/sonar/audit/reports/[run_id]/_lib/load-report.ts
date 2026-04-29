import { cookies, headers } from 'next/headers';
import type { AggregateReport } from '@/lib/haiwave-api';

export type LoadReportResult =
  | { kind: 'ok'; report: AggregateReport }
  | { kind: 'error'; status: number }
  | { kind: 'network-error' };

export async function loadAggregateReport(runId: string): Promise<LoadReportResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/audit/reports/${runId}/aggregate`;

  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    // Shape is guaranteed by the BFF route at /api/account/sonar/audit/reports/[runId]/aggregate,
    // which is typed end-to-end via HaiwaveClient.getAggregateReport. No runtime parse needed.
    const report = (await res.json()) as AggregateReport;
    return { kind: 'ok', report };
  } catch (err) {
    console.error('[loadAggregateReport] network failure', { runId, err });
    return { kind: 'network-error' };
  }
}
