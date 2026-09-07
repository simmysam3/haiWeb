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

// The org's disclosure posture (trust posture grid, sharing policy) and its
// pricing hierarchy are org-wide configuration: transact-level only.
const ROUTES: RouteSpec[] = [
  { name: 'settings/trust-posture/[trust_class]/[modality]', load: () => import('../settings/trust-posture/[trust_class]/[modality]/route'), methods: ['PUT'], params: { trust_class: 'trading_pair', modality: 'audit' } },
  { name: 'sharing-policy', load: () => import('../sharing-policy/route'), methods: ['PUT'] },
  { name: 'pricing', load: () => import('../pricing/route'), methods: ['PUT', 'DELETE'] },
  { name: 'pricing/bulk', load: () => import('../pricing/bulk/route'), methods: ['POST'] },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('trust-posture, sharing-policy and pricing mutations are role-gated (D-55 pattern)', () => {
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
