import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  var __mockClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest) => {
    const client = globalThis.__mockClient;
    return await handler({ client, request: req, params: {}, session: {} });
  },
}));

import { GET } from '../route';

function setMockClient(overrides: Record<string, ReturnType<typeof vi.fn>>) {
  globalThis.__mockClient = {
    listAuditRuns: vi.fn().mockResolvedValue({ runs: [] }),
    listWatcherRuns: vi.fn().mockResolvedValue({ runs: [] }),
    // v1.30 §7.7: PD activity sourced from listPhantomDemandRuns (not fetchRaw windows)
    listPhantomDemandRuns: vi.fn().mockResolvedValue([]),
    // commit 13754a1: route now fetches templates to enrich activity titles
    listRunTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    ...overrides,
  };
}

function makeReq() {
  return new NextRequest('http://localhost:3001/api/account/sonar/dashboard/activity');
}

describe('GET /api/account/sonar/dashboard/activity', () => {
  beforeEach(() => setMockClient({}));

  it('returns empty events array when no runs exist', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toEqual([]);
  });

  it('merges audit + watcher runs sorted by triggered_at desc', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 'a1', status: 'complete', triggered_at: '2026-05-09T03:00:00Z', completed_at: '2026-05-09T03:01:00Z', run_origin: 'ad_hoc' },
          { run_id: 'a2', status: 'failed', triggered_at: '2026-05-09T01:00:00Z', completed_at: null, run_origin: 'template_scheduled' },
        ],
      }),
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 't1', status: 'complete', triggered_at: '2026-05-09T02:00:00Z', completed_at: '2026-05-09T02:05:00Z', run_origin: 'template_manual', signal_types: ['price_change'], counterparty_filter: null, depth_limit: 1 },
        ],
      }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events.map((e: any) => e.run_id)).toEqual(['a1', 't1', 'a2']);
    expect(body.events[0].modality).toBe('audit');
    expect(body.events[0].detail_href).toBe('/account/sonar/audit/a1');
    expect(body.events[1].modality).toBe('watcher');
    expect(body.events[1].detail_href).toBe('/account/sonar/watchers/t1');
  });

  it('caps output at 30 events', async () => {
    const manyRuns = Array.from({ length: 50 }, (_, i) => ({
      run_id: `a${i}`,
      status: 'complete',
      triggered_at: `2026-05-09T${String(i % 24).padStart(2, '0')}:00:00Z`,
      completed_at: null,
      run_origin: 'ad_hoc',
    }));
    setMockClient({ listAuditRuns: vi.fn().mockResolvedValue({ runs: manyRuns }) });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toHaveLength(30);
  });

  it('includes phantom-demand runs as activity events (spec §7.7)', async () => {
    setMockClient({
      listPhantomDemandRuns: vi.fn().mockResolvedValue([
        {
          run_id: 'pd-1',
          status: 'complete',
          created_at: '2026-05-09T04:00:00Z',
          completed_at: '2026-05-09T04:05:00Z',
          run_origin: 'ad_hoc',
        },
      ]),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      modality: 'phantom_demand',
      run_id: 'pd-1',
      detail_href: '/account/sonar/phantom-demand/runs/pd-1',
    });
  });
});

// v1.85 (2026-09-02): dashboards must inherit haiCore's default archived
// exclusion — they never opt in with ?archived=true (D-206). This pins that
// so a future change to this route can't silently start asking for archived
// runs.
describe('GET /api/account/sonar/dashboard/activity — active runs only (D-206)', () => {
  beforeEach(() => setMockClient({}));

  it('asks listAuditRuns, listWatcherRuns, and listPhantomDemandRuns for active runs only', async () => {
    await GET(makeReq(), { params: Promise.resolve({}) });

    const auditArg = globalThis.__mockClient.listAuditRuns.mock.calls[0][0];
    expect(auditArg?.archived).toBeUndefined();

    const watcherArg = globalThis.__mockClient.listWatcherRuns.mock.calls[0][0];
    expect(watcherArg?.archived).toBeUndefined();

    const pdArg = globalThis.__mockClient.listPhantomDemandRuns.mock.calls[0][0];
    expect(pdArg?.archived).toBeUndefined();
  });

  // v1.85 fix wave (C1) — a KEPT run (template deleted, archived_at null per
  // D-206 §2 "keep") still shows up here since dashboards only ever ask for
  // active runs. Its template_id is NULL (FK ON DELETE SET NULL) but haiCore
  // COALESCEs the delete-time name snapshot onto the wire template_name — the
  // event title must use it instead of falling back to "Ad hoc <Modality>".
  it('names a kept watcher/audit run of a deleted definition from the wire template_name', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({
        runs: [
          {
            run_id: 'a-kept',
            status: 'complete',
            triggered_at: '2026-09-02T03:00:00Z',
            completed_at: '2026-09-02T03:01:00Z',
            run_origin: 'template_scheduled',
            template_id: null,
            template_name: 'Kept Audit Definition',
            archived_at: null,
          },
        ],
      }),
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          {
            run_id: 'w-kept',
            status: 'complete',
            triggered_at: '2026-09-02T02:00:00Z',
            completed_at: '2026-09-02T02:05:00Z',
            run_origin: 'template_scheduled',
            template_id: null,
            template_name: 'Kept Watcher Definition',
            archived_at: null,
            signal_types: ['price_change'],
            counterparty_filter: null,
            depth_limit: 1,
          },
        ],
      }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();

    const auditEvent = body.events.find((e: any) => e.run_id === 'a-kept');
    const watcherEvent = body.events.find((e: any) => e.run_id === 'w-kept');
    expect(auditEvent.title).toBe('Kept Audit Definition');
    expect(watcherEvent.title).toBe('Kept Watcher Definition');
  });

  it('passes through exactly the runs the client returned, without re-filtering', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 'a1', status: 'complete', triggered_at: '2026-05-09T03:00:00Z', completed_at: null, run_origin: 'ad_hoc' },
        ],
      }),
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 't1', status: 'complete', triggered_at: '2026-05-09T02:00:00Z', completed_at: null, run_origin: 'ad_hoc', signal_types: [], counterparty_filter: null, depth_limit: 1 },
        ],
      }),
      listPhantomDemandRuns: vi.fn().mockResolvedValue([
        { run_id: 'pd-1', status: 'complete', created_at: '2026-05-09T01:00:00Z', completed_at: null, run_origin: 'ad_hoc' },
      ]),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events.map((e: any) => e.run_id).sort()).toEqual(['a1', 'pd-1', 't1']);
  });
});
