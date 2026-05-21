import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  makePerVendorReport,
  FIXTURE_RUN_ID,
  FIXTURE_VENDOR_A_ID,
} from '../../../_components/__fixtures__/per-vendor-report';

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

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('PerVendorReportPage', () => {
  it('renders header, coverage, SKU table, gap detail, breadcrumb, and download menu when haiCore returns a completed report', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(makePerVendorReport()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { default: Page } = await import('../page');
    const ui = await Page({
      params: Promise.resolve({ run_id: FIXTURE_RUN_ID, vendor_id: FIXTURE_VENDOR_A_ID }),
    });
    render(ui);
    expect(screen.getByText(/Per-vendor report/i)).toBeInTheDocument();
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText(/Coverage summary/i)).toBeInTheDocument();
    expect(screen.getByText(/^SKUs$/i)).toBeInTheDocument();
    expect(screen.getByText(/Gap detail/i)).toBeInTheDocument();
    expect(screen.getByText(/reserved for a future release/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Back to aggregate/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/account/sonar/reports/${FIXTURE_RUN_ID}`);
  });

  it('calls notFound() on 404', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('', { status: 404 }),
    );
    const { default: Page } = await import('../page');
    await expect(
      Page({
        params: Promise.resolve({ run_id: FIXTURE_RUN_ID, vendor_id: FIXTURE_VENDOR_A_ID }),
      }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFound).toHaveBeenCalled();
  });

  it('renders the inline error card on 5xx', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('', { status: 500 }),
    );
    const { default: Page } = await import('../page');
    const ui = await Page({
      params: Promise.resolve({ run_id: FIXTURE_RUN_ID, vendor_id: FIXTURE_VENDOR_A_ID }),
    });
    render(ui);
    expect(screen.getByText(/Couldn.t load this report/i)).toBeInTheDocument();
  });

  it('renders the inline error card on network failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const { default: Page } = await import('../page');
    const ui = await Page({
      params: Promise.resolve({ run_id: FIXTURE_RUN_ID, vendor_id: FIXTURE_VENDOR_A_ID }),
    });
    render(ui);
    expect(screen.getByText(/Couldn.t load this report/i)).toBeInTheDocument();
  });
});
