import Link from 'next/link';
import type { AuditScope } from '@haiwave/protocol';
import { fetchBffJson } from '@/lib/server-fetch';
import { ScopeTable } from '../../../sonar/_components/scope-table';

async function loadScopes(vendorId: string): Promise<AuditScope[]> {
  const result = await fetchBffJson<{ scopes?: AuditScope[] }>(
    `/api/account/audit-scopes?vendor_id=${encodeURIComponent(vendorId)}&active_only=false`,
  );
  if (result.kind === 'error') return [];
  return result.data.scopes ?? [];
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
          href={`/account/sonar/requests/new-nomination?vendor=${encodeURIComponent(id)}`}
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
            Configure from Catalog ›
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
            href={`/account/sonar/observations?tab=audit&counterparty=${encodeURIComponent(id)}`}
            className="text-teal underline hover:text-navy"
          >
            Sonar › Observations › Audit
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
