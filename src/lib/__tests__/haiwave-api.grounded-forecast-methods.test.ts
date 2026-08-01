import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

function mockResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HaiwaveClient grounded-forecast methods (v1.62)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client() {
    return createHaiwaveClient(
      'fake.token.value',
      '00000000-0000-0000-0000-000000000001',
    );
  }

  it('listGroundedForecastTemplates filters /sonar/templates by observation_class', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ templates: [{ template_id: 'gf-1' }] }),
    );
    const result = await client().listGroundedForecastTemplates();
    expect(result).toEqual({ templates: [{ template_id: 'gf-1' }] });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/sonar/templates?');
    expect(url).toContain('observation_class=grounded_forecast');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('listGroundedForecastTemplates tolerates a body with no templates key', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}));
    const result = await client().listGroundedForecastTemplates();
    expect(result).toEqual({ templates: [] });
  });

  it('getGroundedForecastResult GETs the template result route', async () => {
    const body = {
      result: { product_name: 'a2000' },
      run_id: 'run-9',
      last_run_at: '2026-07-30T00:00:00.000Z',
    };
    fetchMock.mockResolvedValueOnce(mockResponse(body));
    const result = await client().getGroundedForecastResult('tpl-7');
    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/grounded-forecasts/templates/tpl-7/result'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getGroundedForecastRunStatus GETs the run status route', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ status: 'running', cancel_requested_at: null }),
    );
    const result = await client().getGroundedForecastRunStatus('run-9');
    expect(result).toEqual({ status: 'running', cancel_requested_at: null });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/sonar/grounded-forecasts/runs/run-9/status'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getGroundedForecastBomSeed GETs bom-seed with an encoded sku', async () => {
    const lines = [
      { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
    ];
    fetchMock.mockResolvedValueOnce(mockResponse({ lines }));
    const result = await client().getGroundedForecastBomSeed('A1000/BLK');
    expect(result).toEqual({ lines });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/sonar/grounded-forecasts/bom-seed?');
    expect(url).toContain('sku=A1000%2FBLK');
  });
});
