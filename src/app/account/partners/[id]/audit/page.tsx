import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import type { AuditScope } from '@haiwave/protocol';
import { ScopeTable } from '../../../sonar/audit/nominations/scope-table';

async function loadScopes(vendorId: string): Promise<AuditScope[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  try {
    const res = await fetch(
      `${baseUrl}/api/account/audit-scopes?vendor_id=${encodeURIComponent(vendorId)}&active_only=false`,
      { headers: { cookie: cookieHeader }, cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { scopes?: AuditScope[] };
    return data.scopes ?? [];
  } catch {
    return [];
  }
}

export default async function PartnerAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scopes = await loadScopes(id);
  return (
    <div className="space-y-6">
      <section>
        <Link
          href={`/account/sonar/audit/nominations/new?vendor=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-navy"
        >
          Nominate components for audit coverage →
        </Link>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-charcoal">Active audit scopes</h2>
          <Link
            href={`/account/partners/${id}/catalog`}
            className="text-xs text-teal hover:text-navy"
          >
            Configure from Catalog &rarr;
          </Link>
        </div>
        <p className="text-xs text-slate mb-3">
          Scopes you&apos;ve configured against this vendor. Disabling a scope removes
          it from future audit runs without deleting existing run history.
        </p>
        <ScopeTable
          initialScopes={scopes}
          emptyMessage={
            <>
              No scopes configured for this vendor yet. Open the{' '}
              <Link
                href={`/account/partners/${id}/catalog`}
                className="text-teal underline hover:text-navy"
              >
                Catalog
              </Link>{' '}
              tab to pick what to audit.
            </>
          }
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-charcoal mb-2">Recent runs</h2>
        <p className="text-xs text-slate">
          Audit runs cover all active scopes across vendors. View the full run
          history in{' '}
          <Link
            href="/account/sonar/audit/runs"
            className="text-teal underline hover:text-navy"
          >
            Sonar &rarr; Audit &rarr; Runs
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
