/**
 * Tests for the run detail page at /account/sonar/audit/[run_id]
 *
 * Mirrors the pattern used by audit/__tests__/page.test.tsx:
 *  - mock next/headers + next/navigation
 *  - stub global fetch (fetchBffJson uses it internally)
 *  - assert key UI elements render
 *
 * Scope-gated assertions:
 *  - complete run → header (title + hash prefix) + tree panel + empty dispatched state
 *  - running run  → in-progress placeholder
 *  - failed run   → error panel + no tree
 *  - NO "Export to recipient" text (§6a deferral)
 *  - NO annotation drawer (§6a deferral)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
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

const BASE_RUN = {
  run_id: RUN_ID,
  initiator_participant_id: '00000000-0000-0000-0000-000000000002',
  triggered_at: '2026-05-21T10:00:00Z',
  triggered_by_user_id: null,
  scope_snapshot: { scope_ids: [], resolved_products: [] },
  completed_at: '2026-05-21T10:05:00Z',
  cancelled_at: null,
  depth_limit: 3,
  hop_count: 12,
  gap_count: 0,
  error_message: null,
  run_origin: 'ad_hoc',
  template_id: null,
  result_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
};

const COMPLETE_RUN = { ...BASE_RUN, status: 'complete' };

const STUB_RESULT = {
  result_id: 'bbbbbbbb-0000-0000-0000-000000000001',
  run_id: RUN_ID,
  vendor_participant_id: 'cccccccc-0000-0000-0000-000000000001',
  product_id: 'SKU-001',
  tree: {
    participant_id: 'cccccccc-0000-0000-0000-000000000001',
    vendor_legal_name: 'Acme Corp',
    payload: {
      kind: 'audit',
      product_id: 'SKU-001',
      disclosure_data: null,
      class_ids: [],
      origin: {
        country_of_origin: 'US',
        city: null,
        state_province: null,
        plant_address: null,
        plant_identifier: null,
        vendor_name: 'Acme Corp',
        certifications: [],
      },
      operational_status: {
        lead_time_meets: null,
        capacity: null,
        delivery_state: null,
      },
    },
    depth_level: 0,
    components: [],
    gap: null,
    synthesis_mode: 'direct',
    identity_redacted: false,
  },
  geo_rollup: [],
  install_compliance_status: null,
};

// Helper: mock BFF run fetch + results fetch for a complete run
function mockCompleteRun() {
  fetchMock
    // BFF run detail
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: COMPLETE_RUN, dispatched_responses: [] }),
    } as Response)
    // results fetch (old /api/account/audit-runs/:id/results path)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [STUB_RESULT] }),
    } as Response);
}

describe('AuditRunDetailPage — complete run', () => {
  it('renders the run title and result_hash prefix in the header', async () => {
    vi.resetModules();
    mockCompleteRun();

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    // Breadcrumb + title (fallback: "Run <prefix>")
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/run/i);
    // result_hash prefix (first 6 chars of 'abcdef...')
    expect(screen.getByText('abcdef')).toBeInTheDocument();
  });

  it('renders the evidence tree panel for a complete run', async () => {
    vi.resetModules();
    mockCompleteRun();

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    expect(screen.getByRole('heading', { name: /evidence tree/i })).toBeInTheDocument();
  });

  it('renders the dispatched-responses empty-state', async () => {
    vi.resetModules();
    mockCompleteRun();

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    expect(screen.getByText(/no external dispatches yet/i)).toBeInTheDocument();
  });

  it('does NOT render "Export to recipient" (§6a deferral)', async () => {
    vi.resetModules();
    mockCompleteRun();

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    expect(screen.queryByText(/export to recipient/i)).not.toBeInTheDocument();
  });

  it('does NOT render an annotation drawer (§6a deferral)', async () => {
    vi.resetModules();
    mockCompleteRun();

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    // Annotation drawer would have text like "Annotate" or "annotation"
    expect(screen.queryByText(/annotation drawer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AuditRunDetailPage — running run', () => {
  it('shows the in-progress placeholder for a running run', async () => {
    vi.resetModules();
    const runningRun = { ...BASE_RUN, status: 'running', completed_at: null, result_hash: null };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: runningRun, dispatched_responses: [] }),
    } as Response);
    // No results fetch for running run

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    expect(screen.getByText(/run in progress/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /evidence tree/i })).not.toBeInTheDocument();
  });
});

describe('AuditRunDetailPage — failed run', () => {
  it('shows the error panel for a failed run and no tree section', async () => {
    vi.resetModules();
    const failedRun = {
      ...BASE_RUN,
      status: 'failed',
      completed_at: null,
      result_hash: null,
      error_message: 'orchestrator timed out',
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: failedRun, dispatched_responses: [] }),
    } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ params: Promise.resolve({ run_id: RUN_ID }) });
    render(ui as React.ReactElement);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /evidence tree/i })).not.toBeInTheDocument();
  });
});

describe('AuditRunDetailPage — notFound on 404', () => {
  it('throws notFound when the BFF returns 404', async () => {
    vi.resetModules();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    } as unknown as Response);

    const Page = (await import('../page')).default;
    await expect(
      Page({ params: Promise.resolve({ run_id: RUN_ID }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
