import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeAggregateReport } from '../_components/__fixtures__/aggregate-report';

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({ notFound }));

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

const RUN_ID = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('AggregateReportPage', () => {
  it('renders all sections when haiCore returns a completed report', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(makeAggregateReport()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { default: Page } = await import('../page');
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui);
    expect(screen.getByText(/Aggregate report/i)).toBeInTheDocument();
    expect(screen.getByText(/Posture summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Geographic rollup/i)).toBeInTheDocument();
    expect(screen.getByText(/Class rollup/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/Per-vendor summary/i)).toBeInTheDocument();
    expect(screen.getByText(/reserved for a future release/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
  });

  it('calls notFound() on 404', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{"error":{"code":"REPORT_NOT_FOUND"}}', { status: 404 }),
    );
    const { default: Page } = await import('../page');
    await expect(
      Page({ params: Promise.resolve({ run_id: RUN_ID }) }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFound).toHaveBeenCalled();
  });

  it('renders the inline error card on 5xx', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('boom', { status: 500 }),
    );
    const { default: Page } = await import('../page');
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui);
    expect(screen.getByText(/Couldn.t load this report/i)).toBeInTheDocument();
  });

  it('renders the in-flight empty state when completed_at is null', async () => {
    const inflight = makeAggregateReport({
      header: { ...makeAggregateReport().header, completed_at: null },
    } as never);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(inflight), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { default: Page } = await import('../page');
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui);
    expect(screen.getByText(/Report not yet available/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to run detail/i }),
    ).toHaveAttribute('href', `/account/sonar/posture/runs/${RUN_ID}`);
  });
});
