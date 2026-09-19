import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserRole } from '@/lib/auth';
import { requestFor, type RouteSpec } from '@/test/role-gate';

const state = vi.hoisted(() => ({ role: 'buyer_view_only' as string, calls: [] as string[] }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { sessionFor } = await import('@/test/role-gate');
  return { ...actual, getSession: vi.fn(async () => sessionFor(state.role as UserRole)), getToken: vi.fn(async () => 'header.payload.signature') };
});
vi.mock('@/lib/haiwave-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/haiwave-api')>('@/lib/haiwave-api');
  const { clientDouble } = await import('@/test/role-gate');
  return { ...actual, createHaiwaveClient: vi.fn(() => clientDouble(state.calls)) };
});

// v1.101 safe-room mutation routes (Tasks 1, 3, 4, 9, 11).
// PF P1: this file lives in src/app/api/account/__tests__/, so ONE `..` reaches
// src/app/api/account — the precedent at role-gate-obligations-audit.test.ts:27 uses one.
// Task 12's admin routes are CUT from this lane (ruling Q1), so nothing here covers
// src/app/api/admin; they would in any case authorize via requireAdminToken rather than
// withHaiCore, and clientDouble's generic {} cannot stand in for their raw-fetch shape.
const ROUTES: RouteSpec[] = [
  { name: 'disclosure-policy', load: () => import('../disclosure-policy/route'), methods: ['PUT'] },
  { name: 'disclosure-policy/overrides/[counterpartyId]', load: () => import('../disclosure-policy/overrides/[counterpartyId]/route'), methods: ['PUT'], params: { counterpartyId: '11111111-1111-4111-8111-111111111111' } },
  { name: 'room-participation', load: () => import('../room-participation/route'), methods: ['PUT'] },
  { name: 'connections/[id]/premier', load: () => import('../connections/[id]/premier/route'), methods: ['PUT'], params: { id: 'conn-1' } },
  { name: 'connections/[id]/activate', load: () => import('../connections/[id]/activate/route'), methods: ['POST'], params: { id: 'conn-1' } },
  { name: 'connections/[id]/decline-activation', load: () => import('../connections/[id]/decline-activation/route'), methods: ['POST'], params: { id: 'conn-1' } },
  { name: 'query-guard/pack', load: () => import('../query-guard/pack/route'), methods: ['PUT'] },
  { name: 'attribute-classes/proposals', load: () => import('../attribute-classes/proposals/route'), methods: ['POST'] },
];

beforeEach(() => { state.calls.length = 0; });

describe('v1.101 safe-room BFF mutations are role-gated (D-211)', () => {
  for (const route of ROUTES) {
    for (const method of route.methods) {
      it(`${method} ${route.name} refuses buyer_view_only with 403 before calling haiCore`, async () => {
        state.role = 'buyer_view_only';
        const mod = await route.load();
        const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
        const res = await handler(requestFor(method), { params: Promise.resolve(route.params ?? {}) });
        expect(res.status).toBe(403);
        expect(state.calls).toEqual([]);
      });

      // PF P28 (ruling Q6): clientDouble resolves {} for every method, so a route that crashes on
      // the upstream response also returns a non-403, non-401 500 — the status alone cannot tell
      // "the gate admitted" from "the handler blew up". Asserting the upstream call can. Both
      // account_admin and account_owner are asserted separately: every route here is gated either
      // by `hasRole(role, 'account_admin')` (auth.ts:228 — account_owner short-circuits true at the
      // top of that ladder) or by `forbidNonEditor`, whose allow-list names account_owner alongside
      // account_admin explicitly (authz.ts:13) rather than deriving it from the ladder. A gate
      // rewritten as a literal `role === 'account_admin'` check would still pass the account_admin
      // arm below but wrongly 403 account_owner, so testing only account_admin would not catch it.
      for (const adminRole of ['account_admin', 'account_owner'] as const) {
        it(`${method} ${route.name} admits ${adminRole} and reaches haiCore`, async () => {
          state.role = adminRole;
          const mod = await route.load();
          const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
          const res = await handler(requestFor(method), { params: Promise.resolve(route.params ?? {}) });
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
          expect(state.calls).toContain('fetchRaw');
        });
      }
    }
  }
});
