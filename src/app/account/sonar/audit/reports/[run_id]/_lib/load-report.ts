import { cookies, headers } from 'next/headers';
import type { AggregateReport } from '@/lib/haiwave-api';

export type LoadReportResult =
  | { kind: 'ok'; report: AggregateReport }
  | { kind: 'error'; status: number };

export async function loadAggregateReport(runId: string): Promise<LoadReportResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/audit/reports/${runId}/aggregate`;

  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    const report = (await res.json()) as AggregateReport;
    return { kind: 'ok', report };
  } catch {
    return { kind: 'error', status: 0 };
  }
}
