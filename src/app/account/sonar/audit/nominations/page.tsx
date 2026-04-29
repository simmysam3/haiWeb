import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import type { AuditScope } from '@haiwave/protocol';
import { Panel } from '@/components';
import { ScopeTable } from './scope-table';

async function loadScopes(): Promise<AuditScope[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  try {
    const res = await fetch(
      `${baseUrl}/api/account/audit-scopes?active_only=false`,
      {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { scopes?: AuditScope[] };
    return data.scopes ?? [];
  } catch (err) {
    console.error('[nominations.loadScopes] network failure', { err });
    return [];
  }
}

export default async function NominationsPage() {
  const scopes = await loadScopes();
  return (
    <div className="p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-semibold text-charcoal">My nominations</h1>
        <Link
          href="/account/sonar/audit/nominations/new"
          className="text-sm text-teal hover:text-navy font-medium"
        >
          + New nomination
        </Link>
      </div>
      <p className="text-sm text-slate mb-6">
        All SKUs you have nominated for audit coverage. Disabling removes a SKU
        from active coverage.
      </p>

      <Panel className="mb-6 p-3 text-xs text-slate">
        <p className="text-charcoal font-medium mb-1">About disclosure keys</p>
        <p>
          Nominations above define <em>what</em> you audit. To unlock fields beyond
          country-of-origin — state, city, vendor identity — issue a{' '}
          <strong>provenance key</strong> and share it out-of-band with your
          vendors. Each vendor installs your key to opt into disclosure. One
          key can be distributed to any number of vendors.
        </p>
        <Link
          href="/account/provenance-keys"
          className="mt-2 inline-block text-teal hover:text-navy font-medium"
        >
          Generate a disclosure key &rarr;
        </Link>
      </Panel>

      <ScopeTable initialScopes={scopes} />
    </div>
  );
}
