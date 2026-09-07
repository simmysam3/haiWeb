import '@testing-library/jest-dom/vitest';
import { useEffect } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SWRConfig, useSWRConfig } from 'swr';
import { ScoreDashboard } from '../score-dashboard';

// This file drives the REAL swr, with the double at the fetch (BFF) boundary, because
// the scenario under test is a revalidation failure: swr sets `error` and KEEPS the
// last good `data`. A mocked `useSWR` cannot express that transition.

const QUARTERS = [
  { period_start: '2025-07-01', period_label: '2025 Q3', overall_score: 0.71, partial: false },
  { period_start: '2025-10-01', period_label: '2025 Q4', overall_score: 0.74, partial: false },
];
const PEER = {
  cohort_size: 7,
  quarters: [
    { period_start: '2025-07-01', period_label: '2025 Q3', composite_avg: 0.68 },
    { period_start: '2025-10-01', period_label: '2025 Q4', composite_avg: 0.69 },
  ],
};

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

let peerStatus = 200;

const fetchStub = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith('/api/account/scores/peer-aggregate'))
    return json(peerStatus, peerStatus === 200 ? PEER : {});
  if (url.startsWith('/api/account/scores/quarterly')) return json(200, { quarters: QUARTERS });
  if (url.startsWith('/api/account/scores/vendor-risk')) return json(200, { vendors: [] });
  return json(200, {});
});

let scopedMutate!: ReturnType<typeof useSWRConfig>['mutate'];
function CaptureMutate() {
  // Captured in an effect, not during render: reassigning a module variable while
  // rendering is a side effect (react-hooks/globals).
  const { mutate } = useSWRConfig();
  useEffect(() => {
    scopedMutate = mutate;
  }, [mutate]);
  return null;
}

afterEach(() => {
  peerStatus = 200;
  vi.unstubAllGlobals();
  fetchStub.mockClear();
});

describe('ScoreDashboard — a peer read that fails on revalidation drops the peer values it still holds', () => {
  it('shows no cohort count and no stale cohort numbers once the peer read 401s', async () => {
    vi.stubGlobal('fetch', fetchStub);
    render(
      // A fresh cache per render, so this file cannot bleed into or out of any other.
      // Retry is off only so the assertion window is deterministic; it is on in production.
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}
      >
        <CaptureMutate />
        <ScoreDashboard />
      </SWRConfig>,
    );

    // The good read landed: the count and the cohort numbers are on the page.
    expect(await screen.findByText(/^7 vendors$/)).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();

    // The session expires; the next revalidation 401s. swr keeps the last good data.
    peerStatus = 401;
    await act(async () => {
      await scopedMutate('/api/account/scores/peer-aggregate?n=5');
    });

    await waitFor(() =>
      expect(screen.getByText(/couldn.t load the vendor cohort benchmark/i)).toBeInTheDocument(),
    );
    // No count beside the failure line, and no stale cohort figure in the trend table.
    expect(screen.queryByText(/^\d+ vendors?$/)).not.toBeInTheDocument();
    expect(screen.queryByText('68')).not.toBeInTheDocument();
    expect(screen.getByText(/cohort unavailable/i)).toBeInTheDocument();
    // The user's own quarters are untouched by the peer failure.
    expect(screen.getByText('71')).toBeInTheDocument();
    expect(screen.getByText('2025 Q3')).toBeInTheDocument();
  });
});
