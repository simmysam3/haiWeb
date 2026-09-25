import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { UserRole } from '@/lib/auth';
import type { Method, RecordedCall, RouteSpec } from '@/test/role-gate';

const state = vi.hoisted(() => ({ role: 'buyer_view_only' as string, calls: [] as string[], recorded: [] as RecordedCall[] }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { sessionFor } = await import('@/test/role-gate');
  return { ...actual, getSession: vi.fn(async () => sessionFor(state.role as UserRole)), getToken: vi.fn(async () => 'header.payload.signature') };
});
vi.mock('@/lib/haiwave-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/haiwave-api')>('@/lib/haiwave-api');
  const { clientDouble } = await import('@/test/role-gate');
  return { ...actual, createHaiwaveClient: vi.fn(() => clientDouble(state.calls, state.recorded)) };
});

const PROJECT = '5a1e0000-0000-4000-8000-000000000001';
const PRODUCT = '5a1e0000-0000-4000-8000-000000000011';
const TEMPLATE = '5a1e0000-0000-4000-8000-000000000021';
const EXECUTION = '5a1e0000-0000-4000-8000-000000000031';
const SCOPE = { kind: 'sourcing_map', project_id: PROJECT, products: [] };

interface SmRouteSpec extends RouteSpec {
  /** haiCore path (without /api/v1) a forwarder must reach. Task 9's two wrappers pin theirs in Task 9. */
  upstream?: string;
  /** Query string per method, sent to the BFF and expected on the haiCore path. */
  queries?: Partial<Record<Method, string>>;
  /** JSON body per method; a method with none sends no body. */
  bodies?: Partial<Record<Method, unknown>>;
}

// Contract §6.2: 21 files, 29 handlers. Spec §10: 403 outside the account_admin family, reads included.
const ROUTES: SmRouteSpec[] = [
  { name: 'projects', load: () => import('../projects/route'), methods: ['GET', 'POST'],
    upstream: '/sourcing-map/projects', bodies: { POST: { name: 'Spring 2027' } } },
  { name: 'projects/[projectId]', load: () => import('../projects/[projectId]/route'), methods: ['GET', 'PATCH', 'DELETE'], params: { projectId: PROJECT },
    upstream: `/sourcing-map/projects/${PROJECT}`, queries: { DELETE: '?disposition=archive' }, bodies: { PATCH: { archived: true }, DELETE: { ignored: true } } },
  { name: 'projects/[projectId]/products', load: () => import('../projects/[projectId]/products/route'), methods: ['GET', 'POST'], params: { projectId: PROJECT },
    upstream: `/sourcing-map/projects/${PROJECT}/products`,
    bodies: { POST: { name: 'Pegasus Trail', unit_label: 'pairs', bom_source: 'workbench', agent_root_sku: null, variant_axis: null, assembly_days: 21 } } },
  { name: 'projects/[projectId]/runs', load: () => import('../projects/[projectId]/runs/route'), methods: ['GET'], params: { projectId: PROJECT },
    upstream: `/sourcing-map/projects/${PROJECT}/runs` },
  { name: 'products/[productId]', load: () => import('../products/[productId]/route'), methods: ['GET', 'PATCH', 'DELETE'], params: { productId: PRODUCT },
    upstream: `/sourcing-map/products/${PRODUCT}`, bodies: { PATCH: { assembly_days: 14 }, DELETE: { ignored: true } } },
  { name: 'products/[productId]/bom-lines', load: () => import('../products/[productId]/bom-lines/route'), methods: ['PUT'], params: { productId: PRODUCT },
    upstream: `/sourcing-map/products/${PRODUCT}/bom-lines`, bodies: { PUT: { lines: [] } } },
  { name: 'products/[productId]/import-agent-bom', load: () => import('../products/[productId]/import-agent-bom/route'), methods: ['POST'], params: { productId: PRODUCT },
    upstream: `/sourcing-map/products/${PRODUCT}/import-agent-bom`, bodies: { POST: { agent_root_sku: 'METCON-CROSS-IRON', mode: 'copy' } } },
  { name: 'agent-parent-skus', load: () => import('../agent-parent-skus/route'), methods: ['GET'],
    upstream: '/sourcing-map/agent-parent-skus' },
  { name: 'class-suggestions', load: () => import('../class-suggestions/route'), methods: ['POST'],
    upstream: '/sourcing-map/class-suggestions', bodies: { POST: { lines: [{ label: 'Upper leather, tumbled' }] } } },
  { name: 'supplier-matches', load: () => import('../supplier-matches/route'), methods: ['POST'],
    upstream: '/sourcing-map/supplier-matches', bodies: { POST: { names: ['Leon Cuero SA', 'Kwang Il'] } } },
  { name: 'class-suppliers', load: () => import('../class-suppliers/route'), methods: ['GET'],
    upstream: '/sourcing-map/class-suppliers', queries: { GET: '?class_id=cpt_flat_laces' } },
  { name: 'classes', load: () => import('../classes/route'), methods: ['GET'],
    upstream: '/sourcing-map/classes', queries: { GET: '?q=leather' } },
  { name: 'runs', load: () => import('../runs/route'), methods: ['POST'],
    bodies: { POST: { template_name: 'Line A base', scope: SCOPE } } },
  { name: 'runs/[templateId]', load: () => import('../runs/[templateId]/route'), methods: ['GET', 'PATCH', 'DELETE'], params: { templateId: TEMPLATE },
    upstream: `/sonar/templates/${TEMPLATE}`, queries: { DELETE: '?runs=archive' },
    bodies: { PATCH: { scope: SCOPE, cadence: { kind: 'manual_only' } }, DELETE: { ignored: true } } },
  { name: 'runs/[templateId]/trigger', load: () => import('../runs/[templateId]/trigger/route'), methods: ['POST'], params: { templateId: TEMPLATE },
    upstream: `/sonar/templates/${TEMPLATE}/trigger` },
  { name: 'runs/[templateId]/duplicate', load: () => import('../runs/[templateId]/duplicate/route'), methods: ['POST'], params: { templateId: TEMPLATE } },
  { name: 'runs/[templateId]/estimate', load: () => import('../runs/[templateId]/estimate/route'), methods: ['POST'], params: { templateId: TEMPLATE },
    upstream: `/sourcing-map/runs/${TEMPLATE}/estimate` },
  { name: 'runs/[templateId]/executions', load: () => import('../runs/[templateId]/executions/route'), methods: ['GET'], params: { templateId: TEMPLATE },
    upstream: `/sourcing-map/runs/${TEMPLATE}/executions` },
  { name: 'executions/[executionId]', load: () => import('../executions/[executionId]/route'), methods: ['GET'], params: { executionId: EXECUTION },
    upstream: `/sourcing-map/executions/${EXECUTION}` },
  { name: 'executions/[executionId]/status', load: () => import('../executions/[executionId]/status/route'), methods: ['GET'], params: { executionId: EXECUTION },
    upstream: `/sourcing-map/executions/${EXECUTION}/status`, queries: { GET: '?cursor=4' } },
  { name: 'executions/[executionId]/cancel', load: () => import('../executions/[executionId]/cancel/route'), methods: ['POST'], params: { executionId: EXECUTION },
    upstream: `/sourcing-map/executions/${EXECUTION}/cancel` },
];

function requestOf(route: SmRouteSpec, method: Method): NextRequest {
  const url = new URL(`/api/account/sourcing-map/x${route.queries?.[method] ?? ''}`, 'http://localhost:3001');
  const body = route.bodies?.[method];
  return body === undefined
    ? new NextRequest(url, { method })
    : new NextRequest(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

/** What smForward must send: no body on GET or DELETE, or when the request had none. */
function expectedInit(route: SmRouteSpec, method: Method): RequestInit {
  const body = route.bodies?.[method];
  if (body === undefined || method === 'GET' || method === 'DELETE') return { method };
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

beforeEach(() => {
  state.calls.length = 0;
  state.recorded.length = 0;
});

describe('Sourcing Map BFF routes forward to haiCore and are role-gated, reads included (contract §6.2, spec §10, AC 1)', () => {
  it('covers 29 handlers in 21 files', () => {
    expect(ROUTES).toHaveLength(21);
    expect(ROUTES.reduce((a, r) => a + r.methods.length, 0)).toBe(29);
  });
  for (const route of ROUTES) {
    for (const method of route.methods) {
      it(`${method} ${route.name} refuses buyer_view_only with 403 before calling haiCore`, async () => {
        state.role = 'buyer_view_only';
        const handler = (await route.load())[method] as Handler;
        const res = await handler(requestOf(route, method), { params: Promise.resolve(route.params ?? {}) });
        expect(res.status).toBe(403);
        expect(state.calls).toEqual([]);
      });
      // L7 precedent (role-gate-safe-room-routes.test.ts): clientDouble resolves {} for every
      // method, so an admitted call ends in a 500; only the upstream call proves admission.
      for (const adminRole of ['account_admin', 'account_owner'] as const) {
        it(`${method} ${route.name} admits ${adminRole} and reaches haiCore`, async () => {
          state.role = adminRole;
          const handler = (await route.load())[method] as Handler;
          const res = await handler(requestOf(route, method), { params: Promise.resolve(route.params ?? {}) });
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
          expect(state.calls).toContain('fetchRaw');
          if (route.upstream) {
            expect(state.recorded.find((c) => c.name === 'fetchRaw')?.args).toEqual([
              `${route.upstream}${route.queries?.[method] ?? ''}`,
              expectedInit(route, method),
            ]);
          }
        });
      }
    }
  }
});
