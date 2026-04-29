import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuditRun } from '@haiwave/protocol';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

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

// Stub all child islands so this test only exercises the header CTA logic.
vi.mock('../rollup-panel', () => ({ RollupPanel: () => <div data-testid="rollup" /> }));
vi.mock('../products-grid', () => ({ ProductsGrid: () => <div data-testid="products" /> }));
vi.mock('../run-controls', () => ({ RunControls: () => <div data-testid="controls" /> }));

const RUN_ID = '00000000-0000-0000-0000-000000000001';

function stubRunFetch(run: Partial<AuditRun>) {
  global.fetch = vi.fn(async (input: string) => {
    if (input.endsWith(`/api/account/audit-runs/${RUN_ID}`)) {
      return new Response(
        JSON.stringify({
          run_id: RUN_ID,
          triggered_at: '2026-04-28T10:00:00.000Z',
          status: 'running',
          hop_count: 0,
          gap_count: 0,
          scope_snapshot: { resolved_products: [] },
          ...run,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // results call
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RunDetailPage — View Aggregate Report CTA', () => {
  it('renders the link when run.status === "complete"', async () => {
    stubRunFetch({ status: 'complete', completed_at: '2026-04-28T10:05:00.000Z' });
    const { default: Page } = await import('../page');
    const ui = await Page({ params: Promise.resolve({ id: RUN_ID }) });
    render(ui);
    const link = screen.getByRole('link', { name: /View Aggregate Report/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/account/sonar/audit/reports/${RUN_ID}`);
  });

  it.each(['running', 'failed', 'cancelled'] as const)(
    'does not render the link when run.status === %s',
    async (status) => {
      stubRunFetch({ status });
      const { default: Page } = await import('../page');
      const ui = await Page({ params: Promise.resolve({ id: RUN_ID }) });
      render(ui);
      expect(
        screen.queryByRole('link', { name: /View Aggregate Report/i }),
      ).not.toBeInTheDocument();
    },
  );
});
