import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { listGroundedForecastTemplates, createRunTemplate } = vi.hoisted(() => ({
  listGroundedForecastTemplates: vi.fn(),
  createRunTemplate: vi.fn(),
}));

// The established BFF-route stub, with the one correction the v1.62 plan calls
// out: it FORWARDS `params`. The pre-existing stubs in this tree hard-code
// `params: {}`, which silently passes any route that reads a dynamic segment.
vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore:
    (handler: (ctx: unknown) => unknown) =>
    async (request: NextRequest, options?: { params?: Promise<unknown> }) =>
      handler({
        client: { listGroundedForecastTemplates, createRunTemplate },
        request,
        params: (await options?.params) ?? {},
      }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const url = 'http://localhost/api/account/sonar/grounded-forecasts';

const validScope = {
  kind: 'grounded_forecast',
  product_name: 'a2000',
  analogue_skus: ['A1000-BLK'],
  bom_lines: [
    { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
  ],
  assembly_days: 21,
  profile: { monthly_qty: 100000, start_month: '2027-01', end_month: '2027-12' },
};

const validBody = {
  template_name: 'a2000 program forecast',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 90,
  scope: validScope,
};

function postRequest(body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('GET /api/account/sonar/grounded-forecasts', () => {
  it('returns only grounded_forecast templates from a mixed list', async () => {
    listGroundedForecastTemplates.mockResolvedValueOnce({
      templates: [
        { template_id: 't-1', observation_class: 'audit', template_name: 'Audit A' },
        { template_id: 't-2', observation_class: 'grounded_forecast', template_name: 'GF B' },
        { template_id: 't-3', observation_class: 'phantom_demand', template_name: 'PD C' },
        { template_id: 't-4', observation_class: 'grounded_forecast', template_name: 'GF D' },
      ],
    });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates.map((t: { template_id: string }) => t.template_id)).toEqual([
      't-2',
      't-4',
    ]);
  });

  it('preserves the templates envelope when nothing matches', async () => {
    listGroundedForecastTemplates.mockResolvedValueOnce({ templates: [] });
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(await res.json()).toEqual({ templates: [] });
  });
});

describe('POST /api/account/sonar/grounded-forecasts', () => {
  it('forces observation_class over a spoofed body value', async () => {
    createRunTemplate.mockResolvedValueOnce({ template: { template_id: 'new-1' } });
    const { POST } = await import('../route');
    const res = await POST(postRequest({ ...validBody, observation_class: 'audit' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ template: { template_id: 'new-1' } });
    expect(createRunTemplate).toHaveBeenCalledWith({
      ...validBody,
      observation_class: 'grounded_forecast',
    });
  });

  it('creates when the caller omits observation_class entirely', async () => {
    createRunTemplate.mockResolvedValueOnce({ template: { template_id: 'new-2' } });
    const { POST } = await import('../route');
    const res = await POST(postRequest(validBody), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(createRunTemplate).toHaveBeenCalledWith({
      ...validBody,
      observation_class: 'grounded_forecast',
    });
  });

  it('returns 400 VALIDATION_ERROR when the scope is not a grounded forecast', async () => {
    const { POST } = await import('../route');
    const res = await POST(
      postRequest({ ...validBody, scope: { kind: 'watcher', sku_asks: [] } }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(json.error.issues)).toBe(true);
    expect(createRunTemplate).not.toHaveBeenCalled();
  });

  it('returns 400 when a required template field is missing', async () => {
    const noName: Record<string, unknown> = { ...validBody };
    delete noName.template_name;
    const { POST } = await import('../route');
    const res = await POST(postRequest(noName), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(createRunTemplate).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not parseable JSON', async () => {
    const { POST } = await import('../route');
    const res = await POST(postRequest('not-json'), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(createRunTemplate).not.toHaveBeenCalled();
  });
});
