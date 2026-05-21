import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import type { AuditScope } from '@haiwave/protocol';

export type ScopesResult =
  | { kind: 'ok'; scopes: AuditScope[] }
  | { kind: 'error'; status: number };

export const getActiveScopes = cache(async (): Promise<ScopesResult> => {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  try {
    const res = await fetch(`${baseUrl}/api/account/audit-scopes?active_only=true`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { kind: 'error', status: res.status };
    const data = (await res.json()) as { scopes?: AuditScope[] };
    return { kind: 'ok', scopes: data.scopes ?? [] };
  } catch (err) {
    console.error('[getActiveScopes] network failure', { err });
    return { kind: 'error', status: 0 };
  }
});
