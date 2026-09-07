import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { ScoreDashboard } from '../score-dashboard';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const ok = (data: unknown) => ({ data, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() }) as never;
const quarter = (period_start: string, period_label: string, overall_score: number) => ({
  period_start,
  period_label,
  overall_score,
  partial: false,
});
// The page's fetcher throws `new Error(`${res.status}`)`, so the double throws the
// bare status too — otherwise nothing pins the sentence the user reads.
const failed = (status: number) => ({ data: undefined, error: new Error(`${status}`), isLoading: false, isValidating: false, mutate: vi.fn() }) as never;

describe('ScoreDashboard — a failed read is never "no score" (SEC-web-account-2-06 instance)', () => {
  beforeEach(() => mockedUseSWR.mockReset());

  it('a failed quarterly read shows a could-not-load line, not "No score available yet."', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/quarterly')) return failed(500);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/couldn.t load your score/i)).toBeInTheDocument();
    expect(screen.queryByText(/No score available yet/i)).not.toBeInTheDocument();
  });

  it('a failed vendor-risk read shows a could-not-load line, not "No vendors in your cohort yet."', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/vendor-risk')) return failed(503);
      if (url.startsWith('/api/account/scores/quarterly')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/peer-aggregate')) return ok({ quarters: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/couldn.t load the vendor risk register/i)).toBeInTheDocument();
    expect(screen.queryByText(/No vendors in your cohort yet/i)).not.toBeInTheDocument();
  });

  it('a failed peer-aggregate read shows a could-not-load line, not "No vendor cohort yet."', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return failed(502);
      if (url.startsWith('/api/account/scores/quarterly')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/couldn.t load the vendor cohort benchmark/i)).toBeInTheDocument();
    expect(screen.queryByText(/No vendor cohort yet/i)).not.toBeInTheDocument();
    // The double throws the bare status the way the page's fetcher does, so this
    // pins the sentence the user actually reads.
    expect(screen.getByText(/haiCore answered 502\. This is not a statement about your cohort\./)).toBeInTheDocument();
  });

  it('a failed quarterly read makes the trend card say so, not "last 0 quarters"', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/quarterly')) return failed(500);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/couldn.t load your trend/i)).toBeInTheDocument();
    expect(screen.queryByText(/last 0 quarters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^No history\.$/)).not.toBeInTheDocument();
  });

  it('a failed peer read leaves the trend card showing your quarters and names the cohort column unavailable', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return failed(504);
      if (url.startsWith('/api/account/scores/quarterly'))
        return ok({ quarters: [quarter('2025-07-01', '2025 Q3', 0.71), quarter('2025-10-01', '2025 Q4', 0.74)] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    // The cohort column is empty because the read failed — the card says so.
    expect(screen.getByText(/cohort unavailable/i)).toBeInTheDocument();
    // Your own quarters are still there.
    expect(screen.getByText(/your trend, last 2 quarters/i)).toBeInTheDocument();
    expect(screen.getByText('2025 Q3')).toBeInTheDocument();
  });

  it('a failed peer read prints no cohort count in the benchmark header, but a successful one still does', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return failed(502);
      if (url.startsWith('/api/account/scores/quarterly')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    const { unmount } = render(<ScoreDashboard />);

    // "0 vendors" beside "Couldn't load" is the empty cohort the finding forbids.
    expect(screen.queryByText(/^\d+ vendors?$/)).not.toBeInTheDocument();
    unmount();

    // Control: a real count on a successful read is untouched.
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return ok({ quarters: [], cohort_size: 7 });
      if (url.startsWith('/api/account/scores/quarterly')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/^7 vendors$/)).toBeInTheDocument();
  });

  it('a successful peer read of cohort_size 0 still prints "0 vendors" — a real empty cohort is a fact', () => {
    mockedUseSWR.mockImplementation(((key: unknown) => {
      const url = String(key);
      if (url.startsWith('/api/account/scores/peer-aggregate')) return ok({ quarters: [], cohort_size: 0 });
      if (url.startsWith('/api/account/scores/quarterly')) return ok({ quarters: [] });
      if (url.startsWith('/api/account/scores/vendor-risk')) return ok({ vendors: [] });
      return ok(undefined);
    }) as never);
    render(<ScoreDashboard />);

    expect(screen.getByText(/^0 vendors$/)).toBeInTheDocument();
    expect(screen.getByText(/No vendor cohort yet/i)).toBeInTheDocument();
  });
});
