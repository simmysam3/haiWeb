import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportsClient } from '../_components/reports-client';

const mockRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/account/sonar/reports',
}));

const sampleReports = [
  {
    run_id: 'aaaa1111-2222-3333-4444-555566667777',
    modality: 'audit' as const,
    name: 'audit run aaaa1111 (5/11/2026)',
    completed_at: '2026-05-11T14:00:00.000Z',
    status: 'complete',
    available_formats: ['html', 'csv'] as const,
  },
];

describe('ReportsClient', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    mockRouter.replace.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders three tabs (audit, watcher, phantom_demand)', () => {
    render(<ReportsClient initialTab="audit" initialReports={[]} />);
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /watcher/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /phantom\s*demand/i })).toBeInTheDocument();
  });

  it('marks initialTab as selected', () => {
    render(<ReportsClient initialTab="watcher" initialReports={[]} />);
    const watcherTab = screen.getByRole('tab', { name: /watcher/i });
    expect(watcherTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows empty state when no reports for the tab', () => {
    render(<ReportsClient initialTab="audit" initialReports={[]} />);
    expect(screen.getByText(/no reports/i)).toBeInTheDocument();
  });

  it('renders a row per report', () => {
    render(<ReportsClient initialTab="audit" initialReports={sampleReports as any} />);
    expect(screen.getByText(/audit run aaaa1111/)).toBeInTheDocument();
  });

  it('navigates with ?tab=X when a different tab is clicked', () => {
    render(<ReportsClient initialTab="audit" initialReports={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /watcher/i }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('?tab=watcher'));
  });
});
