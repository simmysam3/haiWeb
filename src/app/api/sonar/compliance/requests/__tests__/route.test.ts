import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/with-hai-core', () => ({ withHaiCore: (h: unknown) => h }));
import { GET } from '../route';
import type { RequestManagementListResponse } from '@haiwave/protocol';

// v.1.37 IA: BFF accepts the legacy haiCore-facing trio (`awaiting`, `type`,
// `counterparty`) plus two new client-side filters (`state` bucket list,
// `age_bucket` single value). Server-side filtering trims items but
// preserves count fields so the direction-tab badges stay accurate.

type Ctx = { client: { listRequests: ReturnType<typeof vi.fn> }; request: Request };
const invoke = (ctx: Ctx) =>
  (GET as unknown as (c: Ctx) => Promise<Response>)(ctx);

function mockResponse(overrides: Partial<RequestManagementListResponse> = {}): RequestManagementListResponse {
  return {
    items: [],
    total: 0,
    awaiting_me_count: 0,
    awaiting_them_count: 0,
    oldest_awaiting_me_age_days: null,
    ...overrides,
  };
}

const baseNomination = {
  item_type: 'inbound_nomination' as const,
  scope_id: '00000000-0000-0000-0000-000000000001',
  direction: 'awaiting_me' as const,
  counterparty_id: '00000000-0000-0000-0000-000000000010',
  counterparty_legal_name: 'Acme Co',
  subject: 'Audit Acme',
  age_days: 0,
  created_at: '2026-05-21T00:00:00.000Z',
  status: 'pending' as const,
};
const oldNomination = { ...baseNomination, scope_id: '00000000-0000-0000-0000-000000000002', age_days: 40 };
const weekNomination = { ...baseNomination, scope_id: '00000000-0000-0000-0000-000000000003', age_days: 5 };
const monthNomination = { ...baseNomination, scope_id: '00000000-0000-0000-0000-000000000004', age_days: 20 };
const acceptedNomination = { ...baseNomination, scope_id: '00000000-0000-0000-0000-000000000005', status: 'accepted' as const };

const baseObligation = {
  item_type: 'inbound_obligation' as const,
  obligation_id: '00000000-0000-0000-0000-000000000100',
  direction: 'awaiting_me' as const,
  counterparty_id: '00000000-0000-0000-0000-000000000010',
  counterparty_legal_name: 'Acme Co',
  subject: 'SKU widget',
  age_days: 3,
  created_at: '2026-05-19T00:00:00.000Z',
  status: 'outstanding' as const,
};
const resolvedObligation = { ...baseObligation, obligation_id: '00000000-0000-0000-0000-000000000101', status: 'fully_resolved' as const };

describe('GET /api/sonar/compliance/requests — v.1.37 IA', () => {
  it('forwards awaiting/type/counterparty to client.listRequests', async () => {
    const client = { listRequests: vi.fn().mockResolvedValue(mockResponse()) };
    const request = {
      url: 'http://x/api/sonar/compliance/requests?awaiting=them&type=nomination&counterparty=11111111-1111-1111-1111-111111111111',
    } as Request;
    await invoke({ client, request });
    expect(client.listRequests).toHaveBeenCalledWith({
      awaiting: 'them',
      type: 'nomination',
      counterparty: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('accepts awaiting=all as the new direction value', async () => {
    const client = { listRequests: vi.fn().mockResolvedValue(mockResponse()) };
    const request = { url: 'http://x/api/sonar/compliance/requests?awaiting=all' } as Request;
    await invoke({ client, request });
    expect(client.listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ awaiting: 'all' }),
    );
  });

  it('passes through unchanged when no state/age filter is set', async () => {
    const upstream = mockResponse({ items: [baseNomination], total: 1, awaiting_me_count: 1 });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?awaiting=me' } as Request;
    const res = await invoke({ client, request });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('filters by state=pending and keeps original count fields intact', async () => {
    const upstream = mockResponse({
      items: [baseNomination, acceptedNomination, resolvedObligation],
      total: 3,
      awaiting_me_count: 3,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?state=pending' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].scope_id).toBe(baseNomination.scope_id);
    expect(body.total).toBe(3); // unchanged: drives direction-tab badge
    expect(body.awaiting_me_count).toBe(3);
  });

  it('filters by state=resolved (collapses obligation partially/fully_resolved)', async () => {
    const upstream = mockResponse({
      items: [baseObligation, resolvedObligation],
      total: 2,
      awaiting_me_count: 2,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?state=resolved' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].obligation_id).toBe(resolvedObligation.obligation_id);
  });

  it('accepts multi-bucket state filter (comma-separated)', async () => {
    const upstream = mockResponse({
      items: [baseNomination, acceptedNomination, resolvedObligation],
      total: 3,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?state=pending,resolved' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(2);
  });

  it('ignores unknown state values gracefully', async () => {
    const upstream = mockResponse({ items: [baseNomination], total: 1 });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?state=bogus' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    // Unknown bucket → no filter applied → upstream items returned as-is.
    expect(body.items).toHaveLength(1);
  });

  it('filters by age_bucket=today (0 days)', async () => {
    const upstream = mockResponse({
      items: [baseNomination, weekNomination, monthNomination, oldNomination],
      total: 4,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?age_bucket=today' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].age_days).toBe(0);
  });

  it('filters by age_bucket=older (>30 days)', async () => {
    const upstream = mockResponse({
      items: [baseNomination, weekNomination, monthNomination, oldNomination],
      total: 4,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = { url: 'http://x/api/sonar/compliance/requests?age_bucket=older' } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].age_days).toBe(40);
  });

  it('composes state + age_bucket filters', async () => {
    const upstream = mockResponse({
      items: [baseNomination, acceptedNomination, oldNomination],
      total: 3,
    });
    const client = { listRequests: vi.fn().mockResolvedValue(upstream) };
    const request = {
      url: 'http://x/api/sonar/compliance/requests?state=pending&age_bucket=older',
    } as Request;
    const res = await invoke({ client, request });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].scope_id).toBe(oldNomination.scope_id);
  });
});
