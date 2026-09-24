import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockClient = { listPhantomDemandTemplates: vi.fn(), listPhantomDemandRuns: vi.fn() };
type Ctx = { client: unknown; request: NextRequest; params: unknown; session: unknown };
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: Ctx) => unknown) => async (req: NextRequest) =>
    handler({ client: mockClient, request: req, params: {}, session: {} }),
}));

import { GET } from '../route';

describe('GET /api/account/sonar/phantom-demand/queue', () => {
  it('never lists a sourcing_map template in the phantom-demand queue (R-10 census I1)', async () => {
    mockClient.listPhantomDemandTemplates.mockResolvedValue([
      { template_id: 'pd-1', template_name: 'PD one', observation_class: 'phantom_demand', created_at: '2026-09-01T00:00:00.000Z', scope: { kind: 'phantom_demand_bom', sku: 'SKU-1' } },
      { template_id: 'sm-1', template_name: 'Line A base', observation_class: 'sourcing_map', created_at: '2026-09-02T00:00:00.000Z', scope: { kind: 'sourcing_map' } },
    ]);
    mockClient.listPhantomDemandRuns.mockResolvedValue([]);
    const res = await GET(new NextRequest('http://localhost:3001/api/account/sonar/phantom-demand/queue'), { params: Promise.resolve({}) });
    const body = (await res.json()) as { configs: Array<{ template_id: string }> };
    expect(body.configs.map((c) => c.template_id)).toEqual(['pd-1']);
  });
});
