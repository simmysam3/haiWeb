import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObservationsClient } from '../_components/observations-client';

const mockRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/account/sonar/observations',
}));

describe('ObservationsClient', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    if (typeof window !== 'undefined') {
      window.localStorage?.clear?.();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders three tabs (audit, watcher, phantom_demand)', () => {
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /watcher/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /phantom\s*demand/i })).toBeInTheDocument();
  });

  it('marks the initialTab as selected', () => {
    render(<ObservationsClient initialTab="watcher" initialRuns={[]} initialTemplates={[]} />);
    const watcherTab = screen.getByRole('tab', { name: /watcher/i });
    expect(watcherTab.getAttribute('aria-selected')).toBe('true');
  });

  it('navigates with ?tab=X when a different tab is clicked', () => {
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /watcher/i }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringContaining('?tab=watcher'),
    );
  });

  it('shows empty state when both runs and templates are empty', () => {
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    expect(screen.getByText(/create your first/i)).toBeInTheDocument();
  });

  it('renders a row when runs exist', () => {
    const runs = [
      { id: 'r1', scope_summary: 'Test SKU vs Acme', status: 'completed', hops_consumed: 5 },
    ];
    render(<ObservationsClient initialTab="audit" initialRuns={runs} initialTemplates={[]} />);
    expect(screen.getByText(/Test SKU vs Acme/i)).toBeInTheDocument();
  });
});
