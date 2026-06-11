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

function mockScorecard(data: Scorecard | null, extra: Partial<{ loading: boolean; error: string | null }> = {}) {
  useApi.mockReturnValue({
    data,
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
