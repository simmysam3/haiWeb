import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NominationsTable } from '../nominations-table';
import type { InboundNominationGroup } from '../_lib/types';

const group = (g: Partial<InboundNominationGroup>): InboundNominationGroup => ({
  product_id: 'prod-1',
  sku_label: 'WIDGET-7',
  request_count: 3,
  earliest_arrival: '2026-04-28T08:00:00Z',
  status_mix: { outstanding: 3 },
  observers: [
    { obligation_id: 'a', observer_participant_id: 'p1', observer_display_name: 'Acme', product_id: 'prod-1', sku_label: 'WIDGET-7', status: 'outstanding', arrival_time: '2026-04-28T10:00:00Z', resolution_class: 'pending', unresolved_subtier_count: 0 },
    { obligation_id: 'b', observer_participant_id: 'p2', observer_display_name: 'Globex', product_id: 'prod-1', sku_label: 'WIDGET-7', status: 'outstanding', arrival_time: '2026-04-28T08:00:00Z', resolution_class: 'pending', unresolved_subtier_count: 0 },
    { obligation_id: 'c', observer_participant_id: 'p3', observer_display_name: 'Initech', product_id: 'prod-1', sku_label: 'WIDGET-7', status: 'outstanding', arrival_time: '2026-04-28T09:00:00Z', resolution_class: 'pending', unresolved_subtier_count: 0 },
  ],
  ...g,
});

describe('NominationsTable', () => {
  it('renders one row per SKU group with request_count and status mix', () => {
    render(<NominationsTable groups={[group({})]} />);
    expect(screen.getByText('WIDGET-7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3 outstanding')).toBeInTheDocument();
  });

  it('renders multiple SKU groups', () => {
    render(
      <NominationsTable
        groups={[
          group({ product_id: 'p1', sku_label: 'WIDGET-7' }),
          group({ product_id: 'p2', sku_label: 'GASKET-2', request_count: 1, status_mix: { acknowledged: 1 } }),
        ]}
      />,
    );
    expect(screen.getByText('WIDGET-7')).toBeInTheDocument();
    expect(screen.getByText('GASKET-2')).toBeInTheDocument();
    expect(screen.getByText('1 acknowledged')).toBeInTheDocument();
  });
});

describe('NominationsTable expand/collapse', () => {
  it('hides observer rows by default and shows them after clicking the chevron', async () => {
    const user = userEvent.setup();
    render(<NominationsTable groups={[group({})]} />);

    expect(screen.queryByText('Acme')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand widget-7/i }));

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Initech')).toBeInTheDocument();
  });
});
