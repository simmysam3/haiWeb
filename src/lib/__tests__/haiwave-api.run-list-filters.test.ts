import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';
import type { AuditRun, WatcherRun } from '@haiwave/protocol';

const TEMPLATE_A = '00000000-0000-0000-0000-00000000000a';
const TEMPLATE_B = '00000000-0000-0000-0000-00000000000b';

function fakeAuditRun(template_id: string | null, run_id: string): AuditRun {
  return {
    run_id,
    auditor_participant_id: 'caller',
    triggered_at: '2026-05-09T00:00:00Z',
    status: 'complete',
    template_id,
    run_origin: template_id ? 'template_manual' : 'ad_hoc',
  } as unknown as AuditRun;
}

function fakeWatcherRun(template_id: string | null, run_id: string): WatcherRun {
  return {
    run_id,
    initiator_participant_id: 'caller',
    triggered_at: '2026-05-09T00:00:00Z',
    status: 'complete',
    template_id,
    run_origin: template_id ? 'template_manual' : 'ad_hoc',
  } as unknown as WatcherRun;
}

describe('HaiwaveClient run-list filters', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('listAuditRuns with template_id filters client-side', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runs: [
            fakeAuditRun(TEMPLATE_A, 'r1'),
            fakeAuditRun(TEMPLATE_B, 'r2'),
            fakeAuditRun(null, 'r3'),
            fakeAuditRun(TEMPLATE_A, 'r4'),
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    const result = await client.listAuditRuns({ template_id: TEMPLATE_A, limit: 200 });
    expect(result.runs.map((r) => r.run_id)).toEqual(['r1', 'r4']);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('limit=200');
    expect(calledUrl).not.toContain('template_id');
  });

  it('listAuditRuns without template_id passes through unchanged', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ runs: [fakeAuditRun(null, 'r1')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    const result = await client.listAuditRuns({ limit: 25 });
    expect(result.runs).toHaveLength(1);
  });

  it('listWatcherRuns with template_id filters client-side', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runs: [
            fakeWatcherRun(TEMPLATE_A, 't1'),
            fakeWatcherRun(TEMPLATE_B, 't2'),
            fakeWatcherRun(TEMPLATE_A, 't3'),
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    const result = await client.listWatcherRuns({ template_id: TEMPLATE_A });
    expect(result.runs.map((r) => r.run_id)).toEqual(['t1', 't3']);
  });

  it('listWatcherRuns without args returns all runs unfiltered', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ runs: [fakeWatcherRun(null, 't1'), fakeWatcherRun(null, 't2')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    const result = await client.listWatcherRuns();
    expect(result.runs).toHaveLength(2);
  });
});
