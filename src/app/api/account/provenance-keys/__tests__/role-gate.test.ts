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

// Every provenance-key write, plus the plaintext key reveal, binds or exposes
// the org's provenance credentials: transact-level (`account_admin`) only.
const ROUTES: RouteSpec[] = [
  { name: '[keyId]', load: () => import('../[keyId]/route'), methods: ['PATCH', 'DELETE'], params: { keyId: 'key-1' } },
  { name: '[keyId]/value', load: () => import('../[keyId]/value/route'), methods: ['GET'], params: { keyId: 'key-1' } },
  { name: 'generate', load: () => import('../generate/route'), methods: ['POST'] },
  { name: 'installations', load: () => import('../installations/route'), methods: ['POST'] },
  { name: 'installations/preview', load: () => import('../installations/preview/route'), methods: ['POST'] },
  { name: 'installations/[installationId]', load: () => import('../installations/[installationId]/route'), methods: ['PATCH', 'DELETE'], params: { installationId: 'inst-1' } },
];

beforeEach(() => {
  state.calls.length = 0;
});

describe('provenance-keys BFF routes are role-gated (D-55 pattern)', () => {
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
