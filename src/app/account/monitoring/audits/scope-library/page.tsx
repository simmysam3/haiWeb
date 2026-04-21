import { cookies, headers } from 'next/headers';
import type { AuditScope } from '@haiwave/protocol';
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
  } catch {
    return [];
  }
}

export default async function ScopeLibraryPage() {
  const scopes = await loadScopes();
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">
        Scope library
      </h1>
      <p className="text-sm text-slate mb-6">
        All your audit scopes across vendors. Disable removes from active
        coverage.
      </p>
      <ScopeTable initialScopes={scopes} />
    </div>
  );
}
