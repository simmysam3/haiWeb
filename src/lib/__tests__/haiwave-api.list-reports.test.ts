import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

describe('HaiwaveClient.listReports (review #20 I5)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  function mockResponse(body: unknown): void {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  it('maps tab → modality querystring', async () => {
    mockResponse({ reports: [] });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    await client.listReports({ tab: 'audit' });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('modality=audit');
    expect(calledUrl).toContain('/sonar/reports?');
  });

  it('passes tab=watcher as modality=watcher', async () => {
    mockResponse({ reports: [] });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    await client.listReports({ tab: 'watcher' });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('modality=watcher');
  });

  it('passes tab=phantom_demand as modality=phantom_demand', async () => {
    mockResponse({ reports: [] });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    await client.listReports({ tab: 'phantom_demand' });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('modality=phantom_demand');
  });

  it('includes status, date_from, date_to in querystring when provided', async () => {
    mockResponse({ reports: [] });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    await client.listReports({
      tab: 'audit',
      status: 'complete',
      date_from: '2026-05-01T00:00:00.000Z',
      date_to: '2026-05-11T23:59:59.999Z',
    });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('status=complete');
    expect(calledUrl).toContain('date_from=2026-05-01T00%3A00%3A00.000Z');
    expect(calledUrl).toContain('date_to=2026-05-11T23%3A59%3A59.999Z');
  });

  it('omits status/date_from/date_to when undefined', async () => {
    mockResponse({ reports: [] });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    await client.listReports({ tab: 'audit' });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain('status=');
    expect(calledUrl).not.toContain('date_from=');
    expect(calledUrl).not.toContain('date_to=');
  });

  it('returns the response payload unchanged', async () => {
    mockResponse({
      reports: [
        {
          run_id: 'r-1',
          modality: 'audit',
          name: 'audit run r-1',
          completed_at: '2026-05-11T14:00:00.000Z',
          status: 'complete',
          available_formats: ['html', 'csv'],
        },
      ],
    });
    const client = createHaiwaveClient('header.payload.sig', 'caller');
    const result = await client.listReports({ tab: 'audit' });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].run_id).toBe('r-1');
  });
});
