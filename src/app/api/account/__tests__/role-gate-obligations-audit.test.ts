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

// SKU-obligation dispositions bind the org to a customer's request (the D-55
// twin of the compliance-request passthroughs); audit-scope create/delete
// nominates or withdraws a counterparty binding; cancelling or refreshing an
// audit run changes the org's evidence record.
const ROUTES: RouteSpec[] = [
  { name: 'sku-obligations/[id]/acknowledge', load: () => import('../sku-obligations/[id]/acknowledge/route'), methods: ['POST'], params: { id: 'ob-1' } },
  { name: 'sku-obligations/[id]/decline', load: () => import('../sku-obligations/[id]/decline/route'), methods: ['POST'], params: { id: 'ob-1' } },
  { name: 'sku-obligations/[id]/defer', load: () => import('../sku-obligations/[id]/defer/route'), methods: ['POST'], params: { id: 'ob-1' } },
  { name: 'audit-scopes', load: () => import('../audit-scopes/route'), methods: ['POST'] },
  { name: 'audit-scopes/[id]', load: () => import('../audit-scopes/[id]/route'), methods: ['DELETE'], params: { id: 'sc-1' } },
  { name: 'audit-runs/[id]/cancel', load: () => import('../audit-runs/[id]/cancel/route'), methods: ['POST'], params: { id: 'run-1' } },
  { name: 'audit-runs/refresh-vendor', load: () => import('../audit-runs/refresh-vendor/route'), methods: ['POST'] },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('sku-obligation, audit-scope and audit-run mutations are role-gated (D-55 pattern)', () => {
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
