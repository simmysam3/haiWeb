import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserRole } from '@/lib/auth';
import { requestFor, type RecordedCall, type RouteSpec } from '@/test/role-gate';

const state = vi.hoisted(() => ({ role: 'buyer_view_only' as string, calls: [] as string[], recorded: [] as Array<{ name: string; args: unknown[] }> }));

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
  return { ...actual, createHaiwaveClient: vi.fn(() => clientDouble(state.calls, state.recorded)) };
});

// Registering a wallet, publishing a payment manifest and setting the
// spending policy bind the org financially: transact-level only. And the
// subject of each write is the verified session's participant — a body that
// names another participant must not win (SEC-web-api-2-02; D-210's rule on
// the haiCore side).
const ROUTES: Array<RouteSpec & { method: string; upstream: string; body: Record<string, unknown> }> = [
  { name: 'wallet', load: () => import('../wallet/route'), methods: ['POST'], method: 'POST', upstream: 'registerWallet', body: { address: '0xabc' } },
  { name: 'payments', load: () => import('../payments/route'), methods: ['POST'], method: 'POST', upstream: 'updatePaymentManifest', body: { manifest_type: 'vendor', terms: [] } },
  { name: 'policies', load: () => import('../policies/route'), methods: ['POST'], method: 'POST', upstream: 'updateSpendingPolicy', body: { daily_limit_usd: 10 } },
];

beforeEach(() => {
  state.calls.length = 0;
  state.recorded.length = 0;
});

describe('wallet, payments and policies POSTs are role-gated and session-bound', () => {
  for (const route of ROUTES) {
    it(`POST ${route.name} refuses buyer_view_only with 403 before calling haiCore`, async () => {
      state.role = 'buyer_view_only';
      const mod = await route.load();
      const handler = mod.POST as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
      const res = await handler(requestFor('POST', `/api/account/${route.name}`, route.body), { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
      expect(state.calls).toEqual([]);
    });
    it(`POST ${route.name} admits account_admin`, async () => {
      state.role = 'account_admin';
      const mod = await route.load();
      const handler = mod.POST as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
      const res = await handler(requestFor('POST', `/api/account/${route.name}`, route.body), { params: Promise.resolve({}) });
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
    it(`POST ${route.name} writes for the session's participant even when the body names another`, async () => {
      state.role = 'account_admin';
      const mod = await route.load();
      const handler = mod.POST as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
      await handler(
        requestFor('POST', `/api/account/${route.name}`, { ...route.body, participant_id: 'someone-else' }),
        { params: Promise.resolve({}) },
      );
      const call: RecordedCall | undefined = state.recorded.find((c) => c.name === route.upstream);
      expect(call, `expected an upstream ${route.upstream} call`).toBeDefined();
      const payload = call!.args[0] as { participant_id?: string };
      expect(payload.participant_id).toBe('participant-1');
    });
  }
});
