import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Accepting/declining/withdrawing a compliance scope or obligation binds the
// organization to a counterparty — a transact-level action. Read-only roles
// must be refused (they were previously able to mutate this state).
const session = { user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false };
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => session),
  getToken: vi.fn(async () => 'header.body.sig'),
  hasRole: (userRole: string, requiredRole: string) => {
    if (userRole === 'account_owner') return true;
    if (requiredRole === 'account_owner') return false;
    if (requiredRole === 'account_admin') {
      return ['account_admin', 'procurement_transact', 'buyer_full_transact', 'inside_sales_transact'].includes(userRole);
    }
    return userRole === requiredRole;
  },
}));

const ROUTES = [
  'scopes/[id]/accept',
  'scopes/[id]/decline',
  'scopes/[id]/withdraw',
  'obligations/[id]/accept',
  'obligations/[id]/decline',
];

afterEach(() => vi.clearAllMocks());

describe('compliance mutation routes reject read-only roles', () => {
  for (const route of ROUTES) {
    it(`${route} returns 403 for buyer_view_only`, async () => {
      const mod = await import(`../${route}/route`);
      const req = new NextRequest('http://localhost/api/sonar/compliance/requests', { method: 'POST' });
      const res = await mod.POST(req, { params: Promise.resolve({ id: 'x' }) });
      expect(res.status).toBe(403);
    });
  }
});
