import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { UserRole } from '@/lib/auth';

const mockClient = {
  listQueryGuardRules: vi.fn(),
  upsertQueryGuardRule: vi.fn(),
  deleteQueryGuardRule: vi.fn(),
  getQueryGuardMatrix: vi.fn(),
  testQueryGuardRules: vi.fn(),
  listQueryGuardStates: vi.fn(),
  restoreQueryGuardState: vi.fn(),
  clearQueryGuardState: vi.fn(),
  listQueryGuardEvents: vi.fn(),
  getQueryGuardSettings: vi.fn(),
  putQueryGuardSettings: vi.fn(),
};

// The role the mocked session carries. Mutating query-guard routes must
// enforce the strict owner/admin allowlist themselves (spec §9: only
// account_owner / account_admin edit), so the gate is exercised through the
// real handler rather than swallowed by wrapper options this mock discards.
let sessionRole: UserRole = 'account_admin';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: unknown, routeCtx?: { params: Promise<Record<string, string>> }) =>
      handler({
        client: mockClient,
        session: {
          user: { id: 'u1', role: sessionRole },
          participant: { id: 'pid' },
          is_admin: false,
        },
        request,
        params: routeCtx ? await routeCtx.params : {},
      }),
}));

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const ruleBody = {
  scope: 'client_global',
  trust_class: null,
  rule_type: 'sku_repeat',
  window: 'day',
  threshold: 5,
  origin_filter: 'any',
  actions: [{ type: 'log' }],
  enabled: true,
};

describe('query-guard BFF routes', () => {
  beforeEach(() => {
    for (const fn of Object.values(mockClient)) fn.mockReset();
    sessionRole = 'account_admin';
  });

  it('PUT rules forwards body to upsertQueryGuardRule', async () => {
    mockClient.upsertQueryGuardRule.mockResolvedValueOnce({ id: 'r1' });
    const { PUT } = await import('../rules/route');
    const res = await PUT(put(ruleBody), { params: Promise.resolve({}) });
    expect(mockClient.upsertQueryGuardRule).toHaveBeenCalledWith(ruleBody);
    expect(res.status).toBe(200);
  });

  it('GET resolved returns the matrix from getQueryGuardMatrix', async () => {
    const matrix = [{ rule_type: 'sku_repeat', trust_class: 'unknown', source: 'default' }];
    mockClient.getQueryGuardMatrix.mockResolvedValueOnce({ matrix });
    const { GET } = await import('../rules/resolved/route');
    const res = await GET(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({}),
    });
    expect(mockClient.getQueryGuardMatrix).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matrix });
  });

  it('POST restore forwards the state id', async () => {
    mockClient.restoreQueryGuardState.mockResolvedValueOnce({ id: 's1', kind: 'block' });
    const { POST } = await import('../states/[id]/restore/route');
    await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 's1' }),
    });
    expect(mockClient.restoreQueryGuardState).toHaveBeenCalledWith('s1');
  });

  describe('events route request parsing', () => {
    beforeEach(() => {
      mockClient.listQueryGuardEvents.mockResolvedValue({ events: [] });
    });

    it('forwards counterparty, rule_type and a numeric limit', async () => {
      const { GET } = await import('../events/route');
      const res = await GET(
        new NextRequest('http://localhost/x?counterparty=cp-1&rule_type=sku_repeat&limit=5'),
        { params: Promise.resolve({}) },
      );
      expect(mockClient.listQueryGuardEvents).toHaveBeenCalledWith({
        counterparty: 'cp-1',
        rule_type: 'sku_repeat',
        limit: 5,
      });
      expect(res.status).toBe(200);
    });

    it('drops a non-numeric limit and omits absent filters', async () => {
      const { GET } = await import('../events/route');
      await GET(new NextRequest('http://localhost/x?limit=abc'), {
        params: Promise.resolve({}),
      });
      expect(mockClient.listQueryGuardEvents).toHaveBeenCalledWith({
        counterparty: undefined,
        rule_type: undefined,
        limit: undefined,
      });
    });
  });

  describe('mutating routes are restricted to account_owner / account_admin', () => {
    // The over-grant case: hasRole() ladders these transact roles up to
    // account_admin, but the query-guard spec restricts editing to
    // owners/admins only — outbound purchasing authority must not control
    // inbound anti-probing defenses.
    const deniedRoles: UserRole[] = [
      'procurement_transact',
      'buyer_full_transact',
      'inside_sales_transact',
      'buyer_view_only',
    ];
    const allowedRoles: UserRole[] = ['account_owner', 'account_admin'];

    type Route = {
      name: string;
      invoke: () => Promise<Response>;
      clientFn: () => ReturnType<typeof vi.fn>;
    };

    const routes: Route[] = [
      {
        name: 'PUT settings',
        invoke: async () => {
          mockClient.putQueryGuardSettings.mockResolvedValue({});
          const { PUT } = await import('../settings/route');
          return PUT(put({ default_alert_email: 'a@b.co' }), { params: Promise.resolve({}) });
        },
        clientFn: () => mockClient.putQueryGuardSettings,
      },
      {
        name: 'PUT rules',
        invoke: async () => {
          mockClient.upsertQueryGuardRule.mockResolvedValue({ id: 'r1' });
          const { PUT } = await import('../rules/route');
          return PUT(put(ruleBody), { params: Promise.resolve({}) });
        },
        clientFn: () => mockClient.upsertQueryGuardRule,
      },
      {
        name: 'DELETE rules/[id]',
        invoke: async () => {
          mockClient.deleteQueryGuardRule.mockResolvedValue(undefined);
          const { DELETE } = await import('../rules/[id]/route');
          return DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), {
            params: Promise.resolve({ id: 'r1' }),
          });
        },
        clientFn: () => mockClient.deleteQueryGuardRule,
      },
      {
        name: 'POST states/[id]/restore',
        invoke: async () => {
          mockClient.restoreQueryGuardState.mockResolvedValue({ id: 's1' });
          const { POST } = await import('../states/[id]/restore/route');
          return POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
            params: Promise.resolve({ id: 's1' }),
          });
        },
        clientFn: () => mockClient.restoreQueryGuardState,
      },
      {
        name: 'POST states/[id]/clear',
        invoke: async () => {
          mockClient.clearQueryGuardState.mockResolvedValue({ id: 's2' });
          const { POST } = await import('../states/[id]/clear/route');
          return POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
            params: Promise.resolve({ id: 's2' }),
          });
        },
        clientFn: () => mockClient.clearQueryGuardState,
      },
    ];

    for (const route of routes) {
      for (const role of deniedRoles) {
        it(`${route.name} returns 403 for ${role} and never calls haiCore`, async () => {
          sessionRole = role;
          const res = await route.invoke();
          expect(res.status).toBe(403);
          expect(route.clientFn()).not.toHaveBeenCalled();
        });
      }
      for (const role of allowedRoles) {
        it(`${route.name} succeeds for ${role}`, async () => {
          sessionRole = role;
          const res = await route.invoke();
          expect(res.status).toBeLessThan(300);
          expect(route.clientFn()).toHaveBeenCalled();
        });
      }
    }
  });
});
