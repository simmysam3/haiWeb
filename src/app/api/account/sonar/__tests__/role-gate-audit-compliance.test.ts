import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserRole } from '@/lib/auth';
import { requestFor, type RouteSpec } from '@/test/role-gate';

const state = vi.hoisted(() => ({ role: 'buyer_view_only' as string, calls: [] as string[] }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { sessionFor } = await import('@/test/role-gate');
  return {
    ...actual,
    getSession: vi.fn(async () => sessionFor(state.role as UserRole)),
    getToken: vi.fn(async () => 'header.payload.signature'),
  };
});
vi.mock('@/lib/haiwave-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/haiwave-api')>('@/lib/haiwave-api');
  const { clientDouble } = await import('@/test/role-gate');
  return { ...actual, createHaiwaveClient: vi.fn(() => clientDouble(state.calls)) };
});

// Audit definitions and runs, trust bypass, compliance-change processing,
// evidence drafts (incl. dispatch/export, which send evidence outward) and
// working-list state all bind or reconfigure the org: transact-level only.
const ROUTES: RouteSpec[] = [
  { name: 'audit/definitions', load: () => import('../audit/definitions/route'), methods: ['POST'] },
  { name: 'audit/definitions/[id]', load: () => import('../audit/definitions/[id]/route'), methods: ['PATCH', 'DELETE'], params: { id: 'def-1' } },
  { name: 'audit/definitions/[id]/run', load: () => import('../audit/definitions/[id]/run/route'), methods: ['POST'], params: { id: 'def-1' } },
  { name: 'audit/trust-bypass/activate', load: () => import('../audit/trust-bypass/activate/route'), methods: ['POST'] },
  { name: 'audit/trust-bypass/deactivate', load: () => import('../audit/trust-bypass/deactivate/route'), methods: ['POST'] },
  { name: 'compliance/changes/[change_id]/process', load: () => import('../compliance/changes/[change_id]/process/route'), methods: ['POST'], params: { change_id: 'chg-1' } },
  { name: 'compliance/evidence/draft', load: () => import('../compliance/evidence/draft/route'), methods: ['POST'] },
  { name: 'compliance/evidence/draft/[draft_id]/annotations', load: () => import('../compliance/evidence/draft/[draft_id]/annotations/route'), methods: ['POST'], params: { draft_id: 'd-1' } },
  { name: 'compliance/evidence/draft/[draft_id]/annotations/[annotation_id]', load: () => import('../compliance/evidence/draft/[draft_id]/annotations/[annotation_id]/route'), methods: ['PATCH'], params: { draft_id: 'd-1', annotation_id: 'a-1' } },
  { name: 'compliance/evidence/draft/[draft_id]/dispatch', load: () => import('../compliance/evidence/draft/[draft_id]/dispatch/route'), methods: ['POST'], params: { draft_id: 'd-1' } },
  { name: 'compliance/evidence/draft/[draft_id]/export', load: () => import('../compliance/evidence/draft/[draft_id]/export/route'), methods: ['POST'], params: { draft_id: 'd-1' } },
  { name: 'compliance/working-list/items/[canonical_key]/state', load: () => import('../compliance/working-list/items/[canonical_key]/state/route'), methods: ['PUT'], params: { canonical_key: 'k-1' } },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('sonar audit + compliance BFF mutations are role-gated (D-55 pattern)', () => {
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
      it(`${method} ${route.name} admits account_admin`, async () => {
        state.role = 'account_admin';
        const mod = await route.load();
        const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
        const res = await handler(requestFor(method), { params: Promise.resolve(route.params ?? {}) });
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      });
    }
  }
});
