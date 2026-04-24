import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import type { AuditScope } from '@haiwave/protocol';

export const getActiveScopes = cache(async (): Promise<AuditScope[]> => {
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
    if (!res.ok) return [];
    const data = (await res.json()) as { scopes?: AuditScope[] };
    return data.scopes ?? [];
  } catch {
    return [];
  }
});
