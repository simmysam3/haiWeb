import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockClient = {
  listRunTemplates: vi.fn(),
  triggerRunTemplate: vi.fn(),
};

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest) => {
    return await handler({ client: mockClient, request: req, params: {}, session: {} });
  },
}));

import { POST } from '../route';

function makeReq() {
  return new NextRequest('http://localhost:3001/api/account/sonar/templates/run-all', {
    method: 'POST',
  });
}

describe('POST /api/account/sonar/templates/run-all', () => {
  beforeEach(() => {
    mockClient.listRunTemplates.mockReset();
    mockClient.triggerRunTemplate.mockReset();
  });

  it('triggers each enabled template, returns summary', async () => {
    mockClient.listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 'tA', enabled: true, observation_class: 'audit' },
        { template_id: 'tB', enabled: true, observation_class: 'watcher' },
        { template_id: 'tC', enabled: false, observation_class: 'audit' },
      ],
    });
    mockClient.triggerRunTemplate.mockImplementation(async (id: string) => ({
      run_id: `run-${id}`,
    }));
    const res = await POST(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.triggered).toEqual([
      { template_id: 'tA', run_id: 'run-tA' },
      { template_id: 'tB', run_id: 'run-tB' },
    ]);
    expect(body.failed).toEqual([]);
    expect(mockClient.triggerRunTemplate).toHaveBeenCalledTimes(2);
  });

  it('partial failure: returns 200 with failed[] populated', async () => {
    mockClient.listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 'tA', enabled: true, observation_class: 'audit' },
        { template_id: 'tB', enabled: true, observation_class: 'watcher' },
      ],
    });
    mockClient.triggerRunTemplate.mockImplementation(async (id: string) => {
      if (id === 'tB') throw new Error('WATCHER_BUSY');
      return { run_id: `run-${id}` };
    });
    const res = await POST(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggered).toEqual([{ template_id: 'tA', run_id: 'run-tA' }]);
    expect(body.failed).toEqual([{ template_id: 'tB', error_message: 'WATCHER_BUSY' }]);
    expect(body.total).toBe(2);
  });

  it('empty templates: returns total=0 with empty arrays', async () => {
    mockClient.listRunTemplates.mockResolvedValue({ templates: [] });
    const res = await POST(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body).toEqual({ total: 0, triggered: [], failed: [] });
  });

  it('skips disabled templates', async () => {
    mockClient.listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 'tA', enabled: false, observation_class: 'audit' },
        { template_id: 'tB', enabled: false, observation_class: 'watcher' },
      ],
    });
    const res = await POST(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(mockClient.triggerRunTemplate).not.toHaveBeenCalled();
  });
});
