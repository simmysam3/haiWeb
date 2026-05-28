import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PerCounterpartyPostureTable } from '../per-counterparty-posture-table';

describe('<PerCounterpartyPostureTable>', () => {
  it('renders one row per counterparty, sorted by cumulative score desc', () => {
    render(
      <PerCounterpartyPostureTable
        rows={[
          { counterparty_id: 'a', counterparty_name: 'Apex', signals_shared: ['LT'], latest_p50: 5, delta_pct: 0, gap_count: 0, total_runs: 12, cumulative_score: 5 },
          { counterparty_id: 'b', counterparty_name: 'Bolt', signals_shared: [], latest_p50: null, delta_pct: null, gap_count: 12, total_runs: 12, cumulative_score: 60 },
        ]}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Bolt')).toBeInTheDocument();
  });

  it('tints rows where latest run had drift', () => {
    const { container } = render(
      <PerCounterpartyPostureTable
        rows={[
          {
            counterparty_id: 'a',
            counterparty_name: 'Apex',
            signals_shared: ['LT'],
            latest_p50: 12,
            delta_pct: 250,
            gap_count: 0,
            total_runs: 12,
            cumulative_score: 5,
            drift: true,
          },
        ]}
      />,
    );
    const row = container.querySelector('tbody tr');
    expect(row?.className).toMatch(/rose|red/);
  });
});
