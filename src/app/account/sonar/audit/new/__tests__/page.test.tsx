/**
 * Tests for the New Audit page at /account/sonar/audit/new
 *
 * Focus: the "Run again" / ?from_run= source-resolution path.
 *  - ad-hoc run (template_id null) → wizard is prefilled from the run's own
 *    scope_snapshot (re-run mode) instead of opening a blank wizard.
 *  - template-backed run → wizard loads the source DEFINITION (fork-capable).
 *
 * Mirrors audit/[run_id]/__tests__/page.test.tsx:
 *  - mock next/headers + next/navigation
 *  - stub global fetch (fetchBffJson uses it internally)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => {
      if (name === 'host') return 'localhost:3001';
      if (name === 'x-forwarded-proto') return 'http';
      if (name === 'cookie') return '';
      return null;
    },
  }),
  cookies: async () => ({ toString: () => '' }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VENDOR_A = 'cccccccc-0000-0000-0000-000000000001';
const VENDOR_B = 'cccccccc-0000-0000-0000-000000000002';

const AD_HOC_RUN = {
  run_id: RUN_ID,
  initiator_participant_id: '00000000-0000-0000-0000-000000000002',
  triggered_at: '2026-05-21T10:00:00Z',
  triggered_by_user_id: null,
  scope_snapshot: {
    scope_ids: [],
    resolved_products: [
      { vendor_id: VENDOR_A, product_id: 'SKU-001' },
      { vendor_id: VENDOR_A, product_id: 'SKU-002' },
      { vendor_id: VENDOR_B, product_id: 'SKU-003' },
    ],
  },
  status: 'complete',
  completed_at: '2026-05-21T10:05:00Z',
  cancelled_at: null,
  depth_limit: 3,
  hop_count: 12,
  gap_count: 0,
  error_message: null,
  run_origin: 'ad_hoc',
  template_id: null,
  result_hash: null,
};

describe('NewAuditPage — ad-hoc re-run (template_id null)', () => {
  it('prefills the wizard from the run scope_snapshot instead of a blank wizard', async () => {
    vi.resetModules();
    // Only the run fetch happens — no template fetch for an ad-hoc run.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: AD_HOC_RUN, dispatched_responses: [] }),
    } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({
      searchParams: Promise.resolve({ from_run: RUN_ID }),
    });
    render(ui as React.ReactElement);

    // Header reflects the re-run (not the generic blank-wizard copy).
    expect(screen.getByText(/re-running ad-hoc run/i)).toBeInTheDocument();

    // Scope was reconstructed from the snapshot: depth_limit comes off the run.
    const depth = screen.getByLabelText(/depth limit/i) as HTMLInputElement;
    expect(depth.value).toBe('3');

    // Manual cadence + a source ⇒ the submit label is "Run again".
    expect(
      screen.getByRole('button', { name: /run again/i }),
    ).toBeInTheDocument();

    // Exactly one fetch (the run) — no wasted template lookup for ad-hoc.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
