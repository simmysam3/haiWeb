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

// Rules, settings and enforcement-state changes reconfigure how counterparties
// may query the org. These handlers were already gated in-handler by
// `forbidNonEditor` (query-guard/_lib/authz.ts, spec §9) before the role
// sweep; this file pins that behaviour so the sweep's census can rely on it.
// The dry-run evaluator (`test`) persists nothing and stays session-only by
// design.
const ROUTES: RouteSpec[] = [
  { name: 'rules', load: () => import('../rules/route'), methods: ['PUT'] },
  { name: 'rules/[id]', load: () => import('../rules/[id]/route'), methods: ['DELETE'], params: { id: 'rule-1' } },
  { name: 'settings', load: () => import('../settings/route'), methods: ['PUT'] },
  { name: 'states/[id]/clear', load: () => import('../states/[id]/clear/route'), methods: ['POST'], params: { id: 'st-1' } },
  { name: 'states/[id]/restore', load: () => import('../states/[id]/restore/route'), methods: ['POST'], params: { id: 'st-1' } },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('query-guard BFF mutations are role-gated (D-55 pattern)', () => {
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

  it('the dry-run evaluator stays open to every session (positive control for the allowlist)', async () => {
    state.role = 'buyer_view_only';
    const mod = await import('../test/route');
    const handler = mod.POST as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
    const res = await handler(requestFor('POST'), { params: Promise.resolve({}) });
    expect(res.status).not.toBe(403);
  });
});
