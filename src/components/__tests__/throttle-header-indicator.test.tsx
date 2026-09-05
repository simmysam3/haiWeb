import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { ThrottleHeaderIndicator } from '../throttle-header-indicator';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

describe('ThrottleHeaderIndicator — the fetcher checks the status (SEC-web-account-1-06 instance)', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
    mockedUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: vi.fn(), isValidating: false } as never);
  });

  it('polls the throttle status through jsonFetcher, so an error body never reads as a status', () => {
    render(<ThrottleHeaderIndicator />);
    expect(mockedUseSWR).toHaveBeenCalledWith(
      '/api/account/throttle-status',
      jsonFetcher,
      expect.objectContaining({ refreshInterval: 30000 }),
    );
  });
});
