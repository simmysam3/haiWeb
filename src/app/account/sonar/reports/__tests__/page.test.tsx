import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () =>
    Promise.resolve(
      new Map([
        ['host', 'localhost:3001'],
        ['x-forwarded-proto', 'http'],
      ]) as unknown as Headers,
    ),
}));

// Stub the ReportsClient island so this test only exercises the loadReports
// error/empty-state branch in the server component.
vi.mock('../_components/reports-client', () => ({
  ReportsClient: ({ initialReports }: { initialReports: unknown[] }) => (
    <div data-testid="reports-client">rows={initialReports.length}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReportsPage — error vs empty state (review #20 I1)', () => {
  it('throws when the BFF returns non-ok (so Next error boundary handles it)', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'boom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        statusText: 'Internal Server Error',
      }),
    ) as unknown as typeof fetch;

    const { default: ReportsPage } = await import('../page');
    await expect(
      ReportsPage({ searchParams: Promise.resolve({ tab: 'audit' }) }),
    ).rejects.toThrow(/reports list fetch failed/);
  });

  it('renders normally with empty reports list when BFF returns []', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ reports: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    const { default: ReportsPage } = await import('../page');
    const ui = await ReportsPage({ searchParams: Promise.resolve({ tab: 'audit' }) });
    render(ui);
    expect(screen.getByTestId('reports-client')).toHaveTextContent('rows=0');
  });

  it('forwards filter querystrings to the BFF (review #20 I2)', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ reports: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { default: ReportsPage } = await import('../page');
    await ReportsPage({
      searchParams: Promise.resolve({
        tab: 'audit',
        status: 'failed',
        date_from: '2026-05-01T00:00:00.000Z',
        date_to: '2026-05-11T23:59:59.999Z',
      }),
    });
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as unknown as string;
    expect(calledUrl).toContain('tab=audit');
    expect(calledUrl).toContain('status=failed');
    expect(calledUrl).toContain('date_from=2026-05-01T00%3A00%3A00.000Z');
    expect(calledUrl).toContain('date_to=2026-05-11T23%3A59%3A59.999Z');
  });
});
