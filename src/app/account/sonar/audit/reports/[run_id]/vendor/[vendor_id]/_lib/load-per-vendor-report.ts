import { cookies, headers } from 'next/headers';
import type { PerVendorReport } from '@/lib/haiwave-api';

export type LoadPerVendorReportResult =
  | { kind: 'ok'; report: PerVendorReport }
  | { kind: 'error'; status: number }
  | { kind: 'network-error' };

export async function loadPerVendorReport(
  runId: string,
  vendorId: string,
): Promise<LoadPerVendorReportResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/audit/reports/${runId}/vendor/${vendorId}`;

  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    // Shape is guaranteed by the BFF route which is typed end-to-end via
    // HaiwaveClient.getPerVendorReport. No runtime parse needed.
    const report = (await res.json()) as PerVendorReport;
    return { kind: 'ok', report };
  } catch (err) {
    console.error('[loadPerVendorReport] network failure', { runId, vendorId, err });
    return { kind: 'network-error' };
  }
}
