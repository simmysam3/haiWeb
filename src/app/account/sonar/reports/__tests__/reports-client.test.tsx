import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportsClient, FormatDropdown } from '../_components/reports-client';

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
  {
    run_id: 'bbbb2222-3333-4444-5555-666677778888',
    modality: 'audit' as const,
    name: 'audit run bbbb2222 (5/01/2026)',
    completed_at: '2026-05-01T08:00:00.000Z',
    status: 'failed',
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
    expect(screen.getByText(/audit run bbbb2222/)).toBeInTheDocument();
  });

  it('navigates with ?tab=X when a different tab is clicked', () => {
    render(<ReportsClient initialTab="audit" initialReports={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /watcher/i }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('?tab=watcher'));
  });

  // Sortable columns (review #20 I3)
  it('sorts by completed_at descending by default', () => {
    render(<ReportsClient initialTab="audit" initialReports={sampleReports as any} />);
    const rows = screen.getAllByRole('row');
    // First row is the thead, then most-recent-completed (aaaa1111), then bbbb2222
    expect(rows[1]).toHaveTextContent(/aaaa1111/);
    expect(rows[2]).toHaveTextContent(/bbbb2222/);
  });

  it('toggles sort direction when the same column header is clicked twice', () => {
    render(<ReportsClient initialTab="audit" initialReports={sampleReports as any} />);
    const completedBtn = screen.getByRole('button', { name: /completed/i });
    // Default is desc — first click flips to asc.
    fireEvent.click(completedBtn);
    const rows = screen.getAllByRole('row');
    // Now most-recent-completed (aaaa1111) should be LAST.
    expect(rows[1]).toHaveTextContent(/bbbb2222/);
    expect(rows[2]).toHaveTextContent(/aaaa1111/);
  });

  it('sorts by status when status column header is clicked', () => {
    render(<ReportsClient initialTab="audit" initialReports={sampleReports as any} />);
    const statusBtn = screen.getByRole('button', { name: /status/i });
    fireEvent.click(statusBtn);
    const rows = screen.getAllByRole('row');
    // status: complete < failed (asc default for non-completed_at sort keys).
    expect(rows[1]).toHaveTextContent(/aaaa1111/); // complete
    expect(rows[2]).toHaveTextContent(/bbbb2222/); // failed
  });
});

describe('FormatDropdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "no report" when formats is empty', () => {
    const { container } = render(
      <FormatDropdown runId="r-1" modality="watcher" formats={[]} />,
    );
    expect(container).toHaveTextContent(/no report/i);
    expect(container.querySelector('select')).toBeNull();
  });

  it('renders one option per format for audit', () => {
    render(<FormatDropdown runId="r-1" modality="audit" formats={['html', 'csv']} />);
    expect(screen.getByRole('option', { name: 'HTML' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CSV' })).toBeInTheDocument();
  });

  it('opens BFF URL with noopener noreferrer when a format is selected', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<FormatDropdown runId="run-1" modality="audit" formats={['html', 'csv']} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'csv' } });
    expect(openSpy).toHaveBeenCalledWith(
      '/api/account/sonar/audit/reports/run-1/aggregate?format=csv',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('does NOT open a URL for watcher rows (no per-run endpoint)', () => {
    // Watcher modality with formats forced — defensive coverage: even if a
    // server bug emitted formats for watcher, the URL builder returns '#'
    // and window.open must not be called.
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<FormatDropdown runId="run-1" modality="watcher" formats={['html']} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'html' } });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does NOT open a URL for phantom_demand rows (no per-run endpoint)', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<FormatDropdown runId="run-1" modality="phantom_demand" formats={['html']} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'html' } });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
