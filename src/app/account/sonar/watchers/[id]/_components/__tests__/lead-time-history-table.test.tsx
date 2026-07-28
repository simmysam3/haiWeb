import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeadTimeHistoryTable, type LeadTimeHistoryRow } from '../lead-time-history-table';

describe('<LeadTimeHistoryTable>', () => {
  // Newest first. Mirrors the production case: the ask was edited from 23 to 25,
  // so the newest run resolved at 25 and the older runs at 23.
  const rows: LeadTimeHistoryRow[] = [
    {
      run_date: '2026-06-15T00:00:00Z',
      published: 20,
      calibrated: 12,
      soft_quoted: 34,
      soft_quoted_unavailable: false,
      ask_quantity: 25,
      capacity: 'moderate',
    },
    {
      run_date: '2026-06-08T00:00:00Z',
      published: 21,
      calibrated: 13,
      soft_quoted: 31,
      soft_quoted_unavailable: true,
      ask_quantity: 23,
      capacity: 'low',
    },
    {
      run_date: '2026-06-01T00:00:00Z',
      published: 22,
      calibrated: 14,
      soft_quoted: 30,
      soft_quoted_unavailable: false,
      ask_quantity: null,
      capacity: 'high',
    },
  ];

  it('renders no pills in the header', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.queryAllByTestId('pill')).toHaveLength(0);
  });

  it('renders the six column headers plus the lead-time group label', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText('Run date')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Calibrated')).toBeInTheDocument();
    expect(screen.getByText('Soft-quoted')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Available capacity')).toBeInTheDocument();
    expect(screen.getByText('Lead time (days)')).toBeInTheDocument();
  });

  it('shows each run its own quantity rather than one shared value', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    const cells = screen.getAllByTestId('qty-cell');
    expect(cells.map((c) => c.textContent)).toEqual(['25', '23', '—']);
  });

  it('keeps definition tooltips on the defined columns and none on Run date', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    // published, calibrated, soft_quoted, ask_quantity, capacity — five defined
    // columns. Run date has no definition and so no affordance.
    expect(screen.getAllByTestId('column-header-tip')).toHaveLength(5);

    // Assert per-column rather than on the count alone: a bare count passes even
    // if Run date wrongly gained a tooltip while another column lost one.
    for (const label of ['Published', 'Calibrated', 'Soft-quoted', 'Qty', 'Available capacity']) {
      const host = screen.getByText(label).closest('[data-testid="column-header-tip"]');
      expect(host, `${label} should carry a definition`).not.toBeNull();
    }
    expect(
      screen.getByText('Run date').closest('[data-testid="column-header-tip"]'),
    ).toBeNull();
  });

  it('renders the reworded per-run ask-quantity definition on the Qty column', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    const host = screen.getByText('Qty').closest('[data-testid="column-header-tip"]');
    const describedby = host?.getAttribute('aria-describedby');
    expect(document.getElementById(describedby as string)).toHaveTextContent(
      /this run resolved the soft quote for/i,
    );
  });

  it('renders lead-time values without a d suffix now the unit is in the group header', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.queryByText('34d')).not.toBeInTheDocument();
  });

  it('shows an explicit "not available" cell for an unavailable soft quote', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });

  it('emphasizes the newest (row 0) run and not the older rows', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    const newestRow = screen.getByText('34').closest('tr');
    const olderRow = screen.getByText('30').closest('tr');

    expect(newestRow).toHaveClass('font-medium');
    expect(olderRow).not.toHaveClass('font-medium');
  });
});
