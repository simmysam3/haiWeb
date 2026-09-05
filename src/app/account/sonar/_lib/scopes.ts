import { cache } from 'react';
import type { AuditScope } from '@haiwave/protocol';
import { fetchBffJson } from '@/lib/server-fetch';

export type ScopesResult =
  | { kind: 'ok'; scopes: AuditScope[] }
  | { kind: 'error'; status: number };

export const getActiveScopes = cache(async (): Promise<ScopesResult> => {
  // D-62: origin from the configured PORTAL_BASE_URL, never the request's
  // Host header; `fetchBffJson` forwards the cookie and never throws.
  const result = await fetchBffJson<{ scopes?: AuditScope[] }>(
    '/api/account/audit-scopes?active_only=true',
  );
  if (result.kind === 'error') {
    if (result.status === 0) console.error('[getActiveScopes] network failure', { err: result.message });
    return { kind: 'error', status: result.status };
  }
  return { kind: 'ok', scopes: result.data.scopes ?? [] };
});
