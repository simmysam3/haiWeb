import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TemplatesTable } from '../_components/templates-table';

const fakeTpl = {
  template_id: 't1',
  participant_id: 'p1',
  template_name: 'HC-9000 watch',
  observation_class: 'phantom_demand' as const,
  scope: {
    kind: 'phantom_demand_bom',
    sku: 'HC-9000',
    default_qty: 30,
    default_target_date: '2026-06-15',
    vendor_exclude: [],
    weeks_to_hold: 1,
  },
  enabled: true,
  weeks_to_hold: 1,
  created_at: '2026-05-28T00:00:00Z',
  updated_at: '2026-05-28T00:00:00Z',
} as unknown as import('@haiwave/protocol').RunTemplate;

describe('TemplatesTable', () => {
  it('renders empty state', () => {
    render(<TemplatesTable templates={[]} />);
    expect(screen.getByText(/no phantom demand configurations/i)).toBeInTheDocument();
  });
  it('renders one row with sku + qty', () => {
    render(<TemplatesTable templates={[fakeTpl]} />);
    expect(screen.getByText('HC-9000')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
