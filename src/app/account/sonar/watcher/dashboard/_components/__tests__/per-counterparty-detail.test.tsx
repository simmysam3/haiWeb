import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { PerCounterpartyDetail } from '../per-counterparty-detail';
import type { WatcherResult } from '@haiwave/protocol';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const CP = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => mockedUseSWR.mockReset());

function gapResult(): WatcherResult {
  return {
    result_id: 'r1',
    run_id: 'run-1',
    counterparty_participant_id: CP,
    signal_type: 'lead_time_distribution',
    synthesis_mode: 'redacted_gap',
    payload: null,
    gap_reason: 'tier_2_withheld',
    observed_at: '2026-05-27T10:00:00Z',
    tier: 2,
    aggregated_under_tier_1: null,
    external_product_id: null,
  } as WatcherResult;
}

describe('<PerCounterpartyDetail> redaction presentation', () => {
  it('renders the identity-withheld chip for a redacted_gap result and preserves the gap reason', () => {
    mockedUseSWR.mockReturnValue({
      data: { run: {}, results: [gapResult()] },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(
      <PerCounterpartyDetail runId="run-1" counterpartyId={CP} onClose={() => {}} />,
    );
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
    expect(screen.getByText('tier_2_withheld')).toBeInTheDocument();
  });

  it('renders the synthesis-mode badge as a Pill (every-badge-is-a-Pill), not a hand-rolled amber span', () => {
    mockedUseSWR.mockReturnValue({
      data: { run: {}, results: [gapResult()] },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    const { container } = render(
      <PerCounterpartyDetail runId="run-1" counterpartyId={CP} onClose={() => {}} />,
    );
    // The mode badge routes through <Pill> (data-testid="pill").
    expect(screen.getAllByTestId('pill').length).toBeGreaterThanOrEqual(1);
    // No hand-rolled amber status span survives.
    expect(container.querySelector('span.bg-amber-50')).toBeNull();
    expect(container.querySelector('p.text-amber-700')).toBeNull();
  });
});
