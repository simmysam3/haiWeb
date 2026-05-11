import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObservationsClient } from '../_components/observations-client';

const mockRouter = { push: vi.fn(), replace: vi.fn() };
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/account/sonar/observations',
}));

describe('ObservationsClient', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
    mockSearchParams = new URLSearchParams();
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

  it('replaces URL with last-used tab from localStorage when no ?tab= is present', () => {
    window.localStorage.setItem('haiwave.observations.lastTab', 'watcher');
    mockSearchParams = new URLSearchParams();
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.stringContaining('?tab=watcher'),
    );
  });

  it('does not redirect when ?tab= is already in the URL (querystring wins)', () => {
    window.localStorage.setItem('haiwave.observations.lastTab', 'watcher');
    mockSearchParams = new URLSearchParams('tab=audit');
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does not redirect when localStorage matches the server initialTab', () => {
    window.localStorage.setItem('haiwave.observations.lastTab', 'audit');
    mockSearchParams = new URLSearchParams();
    render(<ObservationsClient initialTab="audit" initialRuns={[]} initialTemplates={[]} />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('writes the active tab to localStorage on mount', () => {
    render(<ObservationsClient initialTab="phantom_demand" initialRuns={[]} initialTemplates={[]} />);
    expect(window.localStorage.getItem('haiwave.observations.lastTab')).toBe('phantom_demand');
  });
});
