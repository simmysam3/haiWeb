import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { ScoreDashboard } from '../score-dashboard';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const ok = (data: unknown) => ({ data, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() }) as never;
const failed = (status: number) => ({ data: undefined, error: new Error(`Request failed: ${status}`), isLoading: false, isValidating: false, mutate: vi.fn() }) as never;

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

    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
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
});
