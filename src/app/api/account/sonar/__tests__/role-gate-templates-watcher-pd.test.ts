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

// Definitions (templates, watcher definitions), run triggers, run deletion
// and cancellation, subscriptions, phantom-demand and grounded-forecast runs
// all create or destroy the org's observation configuration or its runs.
const ROUTES: RouteSpec[] = [
  { name: 'templates', load: () => import('../templates/route'), methods: ['POST'] },
  { name: 'templates/[id]', load: () => import('../templates/[id]/route'), methods: ['PATCH', 'DELETE'], params: { id: 't-1' } },
  { name: 'templates/[id]/trigger', load: () => import('../templates/[id]/trigger/route'), methods: ['POST'], params: { id: 't-1' } },
  { name: 'templates/run-all', load: () => import('../templates/run-all/route'), methods: ['POST'] },
  { name: 'watcher/definitions', load: () => import('../watcher/definitions/route'), methods: ['POST'] },
  { name: 'watcher/definitions/[template_id]', load: () => import('../watcher/definitions/[template_id]/route'), methods: ['PATCH', 'DELETE'], params: { template_id: 't-1' } },
  { name: 'watcher/runs', load: () => import('../watcher/runs/route'), methods: ['POST'] },
  { name: 'watcher/runs/[id]', load: () => import('../watcher/runs/[id]/route'), methods: ['DELETE'], params: { id: 'r-1' } },
  { name: 'watcher/runs/[id]/cancel', load: () => import('../watcher/runs/[id]/cancel/route'), methods: ['POST'], params: { id: 'r-1' } },
  { name: 'watcher/subscriptions/[id]', load: () => import('../watcher/subscriptions/[id]/route'), methods: ['PATCH'], params: { id: 's-1' } },
  { name: 'phantom-demand/runs', load: () => import('../phantom-demand/runs/route'), methods: ['POST', 'DELETE'] },
  { name: 'phantom-demand/runs/[id]/cancel', load: () => import('../phantom-demand/runs/[id]/cancel/route'), methods: ['POST'], params: { id: 'r-1' } },
  { name: 'grounded-forecasts', load: () => import('../grounded-forecasts/route'), methods: ['POST'] },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('sonar templates / watcher / phantom-demand / grounded-forecast mutations are role-gated (D-55 pattern)', () => {
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
