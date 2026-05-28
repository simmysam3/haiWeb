import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScopePicker } from '../scope-picker';
import type { RunTemplateScope } from '@haiwave/protocol';

describe('ScopePicker — watcher', () => {
  it('renders signal_types checkboxes for watcher scope', async () => {
    const onChange = vi.fn<(s: RunTemplateScope) => void>();
    render(
      <ScopePicker
        observationClass="watcher"
        value={{
          kind: 'watcher',
          authorization_basis: 'bilateral',
          counterparties: [],
          signal_types: ['lead_time_distribution'],
          skus: [],
          depth_limit: 1,
        }}
        onChange={onChange}
      />,
    );
    const cap = screen.getByLabelText(/capacity utilization band/i);
    await userEvent.click(cap);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        signal_types: expect.arrayContaining([
          'lead_time_distribution',
          'capacity_utilization_band',
        ]),
      }),
    );
  });
});

describe('ScopePicker — phantom_demand', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
  });

  // v.1.44 refined-PD: ScopePicker now delegates to PhantomDemandScopeFields
  // which operates on the phantom_demand_bom shape.  The legacy phantom_demand
  // scope value is accepted as input (still in the RunTemplateScope union) but
  // the ScopePicker falls back to an empty phantom_demand_bom shape, so the
  // rendered fields are the new ones.
  it('phantom_demand renders the new BOM scope fields (Default Target Date, SKU, Weeks to Hold)', () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        observationClass="phantom_demand"
        value={{
          kind: 'phantom_demand_bom',
          sku: '',
          default_qty: 1,
          default_target_date: '',
          vendor_exclude: [],
          weeks_to_hold: 1,
        }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/default target date/i)).toBeInTheDocument();
    expect(screen.getByText(/sku/i)).toBeInTheDocument();
    expect(screen.getByText(/weeks to hold/i)).toBeInTheDocument();
    // Legacy counterparty / hypothetical fields must not appear
    expect(screen.queryByText(/^counterparty$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hypothetical quantity/i)).not.toBeInTheDocument();
  });
});
