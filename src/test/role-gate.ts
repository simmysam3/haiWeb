import { NextRequest } from 'next/server';
import type { Session, UserRole } from '@/lib/auth';

/**
 * Test doubles for BFF role-gate tests. A route wrapped by `withHaiCore`
 * must refuse a `buyer_view_only` session with 403 before any haiCore call
 * when it carries `{ role: 'account_admin' }`, and admit an `account_admin`
 * session. `hasRole(user, 'account_admin')` is the transact-level gate: it
 * passes account_owner, account_admin, procurement_transact,
 * buyer_full_transact and inside_sales_transact.
 */
export function sessionFor(role: UserRole): Session {
  return {
    user: { id: 'user-1', email: 'user@example.test', first_name: 'Test', last_name: 'User', role, job_title: '' },
    participant: { id: 'participant-1', company_name: 'Participant One', status: 'active' },
    is_admin: false,
  };
}

export interface RecordedCall {
  name: string;
  args: unknown[];
}

/**
 * A haiCore client double: every method resolves to `{}`; its name is
 * recorded in `calls` and, when given, the name plus arguments in `recorded`.
 */
export function clientDouble(calls: string[], recorded?: RecordedCall[]): unknown {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === 'string'
          ? (...args: unknown[]) => {
              calls.push(prop);
              recorded?.push({ name: prop, args });
              return Promise.resolve({});
            }
          : undefined,
    },
  );
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function requestFor(method: Method, path = '/api/test', body: unknown = {}): NextRequest {
  const url = new URL(path, 'http://localhost:3001');
  if (method === 'GET') return new NextRequest(url, { method });
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface RouteSpec {
  name: string;
  load: () => Promise<Record<string, unknown>>;
  methods: Method[];
  params?: Record<string, string>;
}
