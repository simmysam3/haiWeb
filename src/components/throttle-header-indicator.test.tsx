import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useSWR from 'swr';
import { ThrottleHeaderIndicator } from './throttle-header-indicator';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

describe('ThrottleHeaderIndicator', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
    if (typeof window !== 'undefined') window.sessionStorage?.clear?.();
  });

  it('renders nothing when count is 0', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 0, most_recent_modality: null },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    const { container } = render(<ThrottleHeaderIndicator />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when data is an error payload with no numeric count', () => {
    mockedUseSWR.mockReturnValue({
      data: { error: { code: 'UNAUTHENTICATED' } },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    const { container } = render(<ThrottleHeaderIndicator />);
    expect(container.textContent).toBe('');
  });

  it('renders count + label when count > 0', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 2, most_recent_modality: 'audit' },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<ThrottleHeaderIndicator />);
    expect(screen.getByText(/2.*throttled/i)).toBeInTheDocument();
  });

  it('renders the badge when count is a positive number', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 3, most_recent_modality: 'audit' },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<ThrottleHeaderIndicator />);
    expect(screen.getByText(/3 runs throttled/i)).toBeInTheDocument();
  });

  it('renders link to /account/usage with modality querystring', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 1, most_recent_modality: 'watcher' },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<ThrottleHeaderIndicator />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(
      '/account/usage?tab=watcher&scrollTo=active-runs',
    );
  });

  it('renders link to /account/usage without tab when modality is null', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 1, most_recent_modality: null },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<ThrottleHeaderIndicator />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/account/usage');
  });

  it('hides after dismiss click within session', () => {
    mockedUseSWR.mockReturnValue({
      data: { count: 1, most_recent_modality: 'audit' },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);
    render(<ThrottleHeaderIndicator />);
    const dismiss = screen.getByLabelText(/dismiss/i);
    fireEvent.click(dismiss);
    expect(screen.queryByText(/throttled/i)).toBeNull();
  });
});
