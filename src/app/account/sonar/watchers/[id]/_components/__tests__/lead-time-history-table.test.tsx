import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeadTimeHistoryTable, type LeadTimeHistoryRow } from '../lead-time-history-table';

describe('<LeadTimeHistoryTable>', () => {
  const rows: LeadTimeHistoryRow[] = [
    // newest first — row 0 is the latest run and is visually emphasized
    {
      run_date: '2026-06-15T00:00:00Z',
      published: 20,
      calibrated: 12,
      soft_quoted: 34,
      soft_quoted_unavailable: false,
      capacity: 'moderate',
    },
    {
      run_date: '2026-06-08T00:00:00Z',
      published: 21,
      calibrated: 13,
      soft_quoted: 31,
      soft_quoted_unavailable: true,
      capacity: 'low',
    },
    {
      run_date: '2026-06-01T00:00:00Z',
      published: 22,
      calibrated: 14,
      soft_quoted: 30,
      soft_quoted_unavailable: false,
      capacity: 'high',
    },
  ];

  it('renders the five column-header tooltips including the ask quantity', () => {
    render(<LeadTimeHistoryTable rows={rows} askQuantity={40} />);

    // Every definitional header is a <Pill> (published, calibrated, soft_quoted,
    // ask_quantity, capacity). Run date is a plain header with no tooltip.
    expect(screen.getAllByTestId('pill')).toHaveLength(5);

    expect(screen.getByText('Run date')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Calibrated')).toBeInTheDocument();
    expect(screen.getByText('Soft-quoted')).toBeInTheDocument();
    expect(screen.getByText('qty 40')).toBeInTheDocument();
    expect(screen.getByText('Available capacity')).toBeInTheDocument();
  });

  it('shows an explicit "not available" cell for an unavailable soft quote', () => {
    render(<LeadTimeHistoryTable rows={rows} askQuantity={40} />);

    expect(screen.getByText('34d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    // row 1 is soft_quoted_unavailable — its soft-quoted cell reads "not available"
    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });

  it('emphasizes the newest (row 0) run and not the older rows', () => {
    render(<LeadTimeHistoryTable rows={rows} askQuantity={40} />);

    const newestRow = screen.getByText('34d').closest('tr');
    const olderRow = screen.getByText('30d').closest('tr');

    expect(newestRow).toHaveClass('font-medium');
    expect(olderRow).not.toHaveClass('font-medium');
  });
});
