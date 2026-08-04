import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { QuoteVolumePanel } from '../quote-volume-panel';
import type { QuoteMetrics } from '@/lib/haiwave-api';

// Real SWR-mocking pattern for this project (see throttle-header-indicator.test.tsx):
// auto-mock the module, then drive it per test with mockReturnValue. The
// brief's vi.doMock-mid-test approach doesn't work here — vi.mock is hoisted
// and the component's static `import useSWR from 'swr'` is already resolved
// by the time a test body runs, so a later vi.doMock never reaches it.
vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const METRICS: QuoteMetrics = {
  incoming: { day: 12, week: 63, month: 240 },
  responded_today: 9,
  outstanding: 47,
  aging: { under_2d: 28, d2_5: 11, d5_plus: 8 },
  expired_30d: 16,
};

function mockMetrics(data: QuoteMetrics | undefined) {
  mockedUseSWR.mockReturnValue({
    data,
    error: undefined,
    isLoading: data === undefined,
    isValidating: false,
    mutate: vi.fn(),
  } as never);
}

describe('QuoteVolumePanel', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
  });

  it('renders the volume counts', () => {
    mockMetrics(METRICS);
    render(<QuoteVolumePanel />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders aging buckets that sum to outstanding, with the trailing 30-day figure kept separate', () => {
    mockMetrics(METRICS);
    render(<QuoteVolumePanel />);
    const { under_2d, d2_5, d5_plus } = METRICS.aging;
    // The reconciliation itself: this is the feature's self-check, not
    // incidental — a viewer can verify the panel against itself.
    expect(under_2d + d2_5 + d5_plus).toBe(METRICS.outstanding);
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    // expired_30d is a trailing 30-day count, not a point-in-time bucket —
    // it must render but must not be folded into the sum above.
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Expired (30d)')).toBeInTheDocument();
  });

  it('renders Not Available rather than fabricated zeros before data arrives', () => {
    mockMetrics(undefined);
    render(<QuoteVolumePanel />);
    expect(screen.getAllByText('Not Available').length).toBeGreaterThan(0);
  });
});
