import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { UsageClient } from '../_components/usage-client';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const seedCurrent = {
  participant_id: 'p1',
  window_start: '2026-05-11T14:00:00.000Z',
  consumed: 120,
  remaining: 4880,
  budget: 5000,
};

describe('UsageClient', () => {
  beforeEach(() => {
    mockedUseSWR.mockImplementation((key: any) => {
      if (typeof key !== 'string') {
        return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() } as any;
      }
      if (key.includes('active-runs')) {
        return { data: { active_runs: [] }, error: undefined, isLoading: false, mutate: vi.fn() } as any;
      }
      if (key.includes('timeseries')) {
        return { data: { buckets: [] }, error: undefined, isLoading: false, mutate: vi.fn() } as any;
      }
      if (key.includes('counterparties')) {
        return { data: { counterparties: [] }, error: undefined, isLoading: false, mutate: vi.fn() } as any;
      }
      if (key.includes('throttle-history')) {
        return { data: { throttle_history: [] }, error: undefined, isLoading: false, mutate: vi.fn() } as any;
      }
      return { data: undefined, error: undefined, isLoading: true, mutate: vi.fn() } as any;
    });
  });

  it('renders current consumption from initial props', () => {
    render(<UsageClient initialCurrent={seedCurrent} />);
    expect(screen.getByText(/120/)).toBeInTheDocument();
    // 5,000 appears in both the CurrentHeader budget and the BudgetDisplay; use getAllByText.
    expect(screen.getAllByText(/5,?000/).length).toBeGreaterThan(0);
  });

  it('renders empty state in active runs section when no active runs', () => {
    render(<UsageClient initialCurrent={seedCurrent} />);
    expect(screen.getByText(/no active runs/i)).toBeInTheDocument();
  });

  it('renders empty state in throttle history when none', () => {
    render(<UsageClient initialCurrent={seedCurrent} />);
    expect(screen.getByText(/no throttle events/i)).toBeInTheDocument();
  });

  it('renders email-support note in budget display', () => {
    render(<UsageClient initialCurrent={seedCurrent} />);
    expect(screen.getByText(/support@haiwave\.ai/i)).toBeInTheDocument();
  });

  it('handles null initialCurrent gracefully', () => {
    render(<UsageClient initialCurrent={null} />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
