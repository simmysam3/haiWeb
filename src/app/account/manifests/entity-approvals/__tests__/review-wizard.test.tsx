import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewWizard } from '../review-wizard';
import type { EntityApprovalQueueRow } from '../approvals-queue';
import type { Scorecard } from '@/lib/library-types';

const useApi = vi.fn();
vi.mock('@/lib/use-api', () => ({
  useApi: (opts: unknown) => useApi(opts),
}));

const ROW: EntityApprovalQueueRow = {
  request_id: 'req-1',
  counterparty: { id: 'cp-1', name: 'Acme Brass' },
  submitted_at: '2026-06-01T12:00:00Z',
  gap_count: 1,
  status: 'pending',
  last_decision: null,
};

const SCORECARD: Scorecard = {
  tier: 'connection',
  gap_count: 1,
  counts: { met: 1, missing: 1 },
  rows: [
    {
      element_key: 'terms_of_sale', label: 'Terms of Sale', kind: 'artifact', status: 'met',
      required_min_amount_usd: null, held_amount_usd: null, held_value: null, evidence: [], waiver_reason: null,
    },
    {
      element_key: 'iso9001', label: 'ISO 9001', kind: 'artifact', status: 'missing',
      required_min_amount_usd: null, held_amount_usd: null, held_value: null, evidence: [], waiver_reason: null,
    },
  ],
};

// Mirrors the real BFF passthrough of haiCore's scorecard endpoints:
// `{ scorecard: {...} }`, NOT the bare scorecard object.
function mockScorecard(scorecard: Scorecard | null, extra: Partial<{ loading: boolean; error: string | null }> = {}) {
  useApi.mockReturnValue({
    data: scorecard === null ? {} : { scorecard },
    loading: extra.loading ?? false,
    error: extra.error ?? null,
    refetch: vi.fn(),
  });
}

describe('ReviewWizard — scorecard step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScorecard(SCORECARD);
  });

  it('fetches the request scorecard at the default connection tier', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    const url = (useApi.mock.calls[0][0] as { url: string }).url;
    expect(url).toBe('/api/account/entity-approvals/req-1/scorecard?tier=connection');
  });

  it('renders the three wizard steps in the rail', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Requirements/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decision/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
  });

  it('renders the scorecard table rows in step 1', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByText('Terms of Sale')).toBeInTheDocument();
    expect(screen.getByText('ISO 9001')).toBeInTheDocument();
  });

  it('shows a loading state while the scorecard loads', () => {
    mockScorecard(null, { loading: true });
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error state when the scorecard fails', () => {
    mockScorecard(null, { error: '500' });
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByText(/couldn.t load|failed|error/i)).toBeInTheDocument();
  });

  it('Back to queue calls onClose', () => {
    const onClose = vi.fn();
    render(<ReviewWizard row={ROW} onClose={onClose} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /back to queue/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

const NO_GAP_SCORECARD: Scorecard = {
  tier: 'connection',
  gap_count: 0,
  counts: { met: 2 },
  rows: [
    { element_key: 'terms_of_sale', label: 'Terms of Sale', kind: 'artifact', status: 'met', required_min_amount_usd: null, held_amount_usd: null, held_value: null, evidence: [], waiver_reason: null },
    { element_key: 'iso9001', label: 'ISO 9001', kind: 'artifact', status: 'met', required_min_amount_usd: null, held_amount_usd: null, held_value: null, evidence: [], waiver_reason: null },
  ],
};

const APPROVED_ROW: EntityApprovalQueueRow = {
  ...ROW,
  request_id: null,
  status: 'approved',
  last_decision: { decision: 'approved', tier: 'connection', decided_by: 'jerry@apex.test', decided_at: '2026-05-22T09:00:00Z' },
};

describe('ReviewWizard — initial tier for an approved row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScorecard(SCORECARD);
  });

  it('opens at the currently-approved tier, not the default (tier-upgrade walkthrough bug)', () => {
    const upgraded: EntityApprovalQueueRow = {
      ...ROW,
      request_id: null,
      status: 'approved',
      last_decision: { decision: 'approved', tier: 'trading_pair', decided_by: 'jerry@apex.test', decided_at: '2026-05-22T09:00:00Z' },
    };
    render(<ReviewWizard row={upgraded} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect((useApi.mock.calls[0][0] as { url: string }).url).toContain('tier=trading_pair');
    expect(screen.getByRole('radio', { name: 'Trading Pair' })).toBeChecked();
  });

  it('falls back to the default tier when last_decision carries an unknown tier', () => {
    const odd: EntityApprovalQueueRow = {
      ...ROW,
      request_id: null,
      status: 'approved',
      last_decision: { decision: 'approved', tier: 'bogus_tier', decided_by: 'jerry@apex.test', decided_at: '2026-05-22T09:00:00Z' },
    };
    render(<ReviewWizard row={odd} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect((useApi.mock.calls[0][0] as { url: string }).url).toContain('tier=connection');
  });

  it('still opens pending rows at the default tier', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect((useApi.mock.calls[0][0] as { url: string }).url).toContain('tier=connection');
  });
});

describe('ReviewWizard — decision + confirm steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScorecard(SCORECARD);
  });

  it('renders a tier picker with all four tier labels', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Premier' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Trading Pair' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Qualified' })).toBeInTheDocument();
  });

  it('changing the tier refetches the scorecard at the new tier', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Premier' }));
    const lastUrl = (useApi.mock.calls.at(-1)![0] as { url: string }).url;
    expect(lastUrl).toBe('/api/account/entity-approvals/req-1/scorecard?tier=premier');
  });

  it('blocks approve submit with a message when gaps remain and no reason is given', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
  });

  it('allows approve submit without a reason at zero gaps', async () => {
    mockScorecard(NO_GAP_SCORECARD);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onDecided = vi.fn();
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={onDecided} />);
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/entity-approvals/req-1/approve');
    await vi.waitFor(() => expect(onDecided).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('approve with a reason and gaps POSTs tier + reason and calls onDecided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onDecided = vi.fn();
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={onDecided} />);
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'long-standing relationship' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Trading Pair' }));
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ tier: 'trading_pair', reason: 'long-standing relationship' });
    await vi.waitFor(() => expect(onDecided).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('surfaces a server REASON_REQUIRED 400 via the error path', async () => {
    mockScorecard(NO_GAP_SCORECARD);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      clone: () => ({ json: () => Promise.resolve({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }) }),
      json: () => Promise.resolve({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(screen.getByText(/a reason is required/i)).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('offers a Revoke mode only for an already-approved row', () => {
    const { unmount } = render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: /revoke/i })).toBeNull();
    unmount();
    render(<ReviewWizard row={APPROVED_ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /revoke/i })).toBeInTheDocument();
  });

  it('revoke requires a reason of at least 10 characters', () => {
    render(<ReviewWizard row={APPROVED_ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /revoke/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'too short' } });
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('revoke prefills outstanding-element checkboxes from the current gap rows', () => {
    render(<ReviewWizard row={APPROVED_ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /revoke/i }));
    // ISO 9001 is the only gap (missing) in SCORECARD → its checkbox is checked.
    const cb = screen.getByRole('checkbox', { name: /ISO 9001/ }) as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('revoke POSTs to the counterparty revoke route with reason + outstanding keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onDecided = vi.fn();
    render(<ReviewWizard row={APPROVED_ROW} onClose={vi.fn()} onDecided={onDecided} />);
    fireEvent.click(screen.getByRole('radio', { name: /revoke/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'coverage lapsed — please re-submit' } });
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/entity-approvals/counterparty/cp-1/revoke');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reason).toMatch(/coverage lapsed/);
    expect(body.outstanding_element_keys).toContain('iso9001');
    await vi.waitFor(() => expect(onDecided).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });

  it('proactive approve (request_id null) POSTs to the counterparty approve route', async () => {
    mockScorecard(NO_GAP_SCORECARD);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReviewWizard row={APPROVED_ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    // APPROVED_ROW defaults to approve mode is fine; ensure approve is selected.
    fireEvent.click(screen.getByRole('radio', { name: /^approve/i }));
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/entity-approvals/counterparty/cp-1/approve');
    vi.unstubAllGlobals();
  });

  it('confirm preview shows the counterparty name, decision and tier label', () => {
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    const preview = screen.getByTestId('decision-preview');
    expect(preview).toHaveTextContent('Acme Brass');
    expect(preview).toHaveTextContent(/Connection/);
  });

  it('re-approving a non-pending row (resolved request_id) POSTs to the counterparty route', async () => {
    mockScorecard(NO_GAP_SCORECARD);
    // A revoked row reopened from the All filter still carries its old (now
    // resolved) request_id; haiCore's /:requestId/approve asserts pending, so
    // the client must use the counterparty route for any non-pending row.
    const revokedWithRequest: EntityApprovalQueueRow = {
      ...ROW,
      request_id: 'req-1',
      status: 'revoked',
      last_decision: { decision: 'revoked', tier: null, decided_by: 'jerry@apex.test', decided_at: '2026-05-22T09:00:00Z' },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReviewWizard row={revokedWithRequest} onClose={vi.fn()} onDecided={vi.fn()} />);
    // Ensure approve mode (revoked rows are not approved → canRevoke is false anyway).
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/entity-approvals/counterparty/cp-1/approve');
    vi.unstubAllGlobals();
  });

  it('disables submit while the scorecard is loading (stale gap-count guard)', () => {
    mockScorecard(null, { loading: true });
    render(<ReviewWizard row={ROW} onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^submit/i })).toBeDisabled();
  });
});

const PROACTIVE_ROW: EntityApprovalQueueRow = {
  request_id: null,
  counterparty: { id: 'cp-9', name: 'Gamma Plastics' },
  submitted_at: null,
  gap_count: 0,
  status: 'pending',
  last_decision: null,
};

describe('ReviewWizard — proactive (counterparty) mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScorecard(NO_GAP_SCORECARD);
  });

  it('fetches the scorecard from the counterparty endpoint', () => {
    render(<ReviewWizard row={PROACTIVE_ROW} proactive onClose={vi.fn()} onDecided={vi.fn()} />);
    expect((useApi.mock.calls[0][0] as { url: string }).url).toBe(
      '/api/account/entity-approvals/counterparty/cp-9/scorecard?tier=connection',
    );
  });

  it('shows the proactive subtitle and offers no revoke radio', () => {
    render(<ReviewWizard row={PROACTIVE_ROW} proactive onClose={vi.fn()} onDecided={vi.fn()} />);
    expect(screen.getByText(/proactive approval/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /revoke/i })).toBeNull();
  });

  it('approve POSTs to the counterparty approve endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const onDecided = vi.fn();
    render(<ReviewWizard row={PROACTIVE_ROW} proactive onClose={vi.fn()} onDecided={onDecided} />);
    fireEvent.click(screen.getByRole('button', { name: /^submit/i }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/entity-approvals/counterparty/cp-9/approve');
    await vi.waitFor(() => expect(onDecided).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
