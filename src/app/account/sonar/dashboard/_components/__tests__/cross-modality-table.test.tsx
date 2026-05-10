import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CrossModalityTable } from '../cross-modality-table';

const partners = [
  {
    partner_id: 'p1',
    partner_name: 'A Co',
    audit: { compliant: 5, partial: 0, non_compliant: 5, total: 10 },
    phantom_demand: { response_rate: 0.5, window_id: 'w1' },
    watcher: { capacity_band: 'high' as const, lead_time_p90_days: 14 },
    risk_score: 0.6,
    risk_color: 'yellow' as const,
    risk_label: 'elevated' as const,
  },
  {
    partner_id: 'p2',
    partner_name: 'B Co',
    audit: { compliant: 10, partial: 0, non_compliant: 0, total: 10 },
    phantom_demand: null,
    watcher: null,
    risk_score: 0.15,
    risk_color: 'green' as const,
    risk_label: 'normal' as const,
  },
];

describe('CrossModalityTable', () => {
  it('default sort is by risk_score desc (highest risk first)', () => {
    render(<CrossModalityTable partners={partners} />);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('A Co')).toBeInTheDocument();
    expect(within(rows[2]).getByText('B Co')).toBeInTheDocument();
  });

  it('clicking partner column header re-sorts ascending alphabetic', () => {
    render(<CrossModalityTable partners={partners} />);
    fireEvent.click(screen.getByRole('button', { name: /Partner/i }));
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('A Co')).toBeInTheDocument();
    expect(within(rows[2]).getByText('B Co')).toBeInTheDocument();
  });

  it('renders dash for missing modality cells', () => {
    render(<CrossModalityTable partners={partners} />);
    const rows = screen.getAllByRole('row');
    const bRow = rows.find((r) => within(r).queryByText('B Co'));
    expect(bRow).toBeDefined();
    const dashes = within(bRow!).getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('empty state when no partners', () => {
    render(<CrossModalityTable partners={[]} />);
    expect(screen.getByText(/No partners observed yet/i)).toBeInTheDocument();
  });
});
