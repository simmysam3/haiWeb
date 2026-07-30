import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { LatestSnapshot } from '../latest-snapshot';
import type { WatcherResult } from '@haiwave/protocol';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

beforeEach(() => mockedUseSWR.mockReset());

function gapResult(): WatcherResult {
  return {
    result_id: 'r1',
    run_id: 'run-1',
    counterparty_participant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    signal_type: 'lead_time_distribution',
    synthesis_mode: 'redacted_gap',
    payload: null,
    gap_reason: 'tier_2_identity_withheld',
    observed_at: '2026-05-27T10:00:00Z',
    tier: 2,
    aggregated_under_tier_1: null,
    external_product_id: null,
  } as WatcherResult;
}

describe('<LatestSnapshot> redaction chip', () => {
  it('renders the VerifiedUndisclosedChip for a redacted_gap row and never the raw redacted_gap span', () => {
    mockedUseSWR.mockReturnValue({
      data: { run: {}, results: [gapResult()] },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<LatestSnapshot runId="run-1" onSelectCounterparty={() => {}} />);
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
    expect(screen.queryByText('redacted_gap')).toBeNull();
  });
});
