import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * GET /account/sonar/phantom-demand/reports/latest
 *
 * Resolves the caller's latest phantom-demand window via the BFF and 302s
 * to the canonical `/reports/{window_id}` URL so deep-links from the
 * sidebar always land on a real report.
 */
export default async function LatestPhantomDemandReportPage() {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/account/sonar/phantom-demand/reports/latest`;

  let windowId: string | null = null;
  try {
    const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: 'no-store' });
    if (res.ok) {
      const body = (await res.json()) as { window_id: string };
      windowId = body.window_id;
    }
  } catch (err) {
    console.error('[LatestPhantomDemandReportPage] resolve failure', { err });
  }

  if (!windowId) {
    return (
      <div className="px-8 py-10">
        <div className="rounded-md border border-problem/20 bg-problem/5 p-6 text-sm text-problem">
          Couldn&apos;t resolve a phantom demand window. The phantom demand service is
          temporarily unavailable.
        </div>
      </div>
    );
  }

  redirect(`/account/sonar/phantom-demand/reports/${windowId}`);
}
