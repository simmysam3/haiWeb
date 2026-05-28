import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ScopePicker } from '../scope-picker';

describe('ScopePicker — phantom_demand', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
  });

  // v.1.44 refined-PD: ScopePicker delegates to PhantomDemandScopeFields, which
  // operates on the phantom_demand_bom shape.
  // v.1.45: ScopePicker is phantom-demand-only (the watcher branch was removed —
  // watchers use the dedicated /watchers/new wizard), so it no longer takes an
  // observationClass prop.
  it('renders the BOM scope fields (Default Target Date, SKU, hold-for-weeks)', () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        value={{
          kind: 'phantom_demand_bom',
          sku: '',
          default_qty: 1,
          default_target_date: '',
          vendor_exclude: [],
          weeks_to_hold: 1,
          catalog_source: { kind: 'own' },
        }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/default target date/i)).toBeInTheDocument();
    expect(screen.getByText(/sku/i)).toBeInTheDocument();
    expect(
      screen.getByText(/save phantom demand request for \(weeks\)/i),
    ).toBeInTheDocument();
    // Legacy counterparty / hypothetical fields must not appear
    expect(screen.queryByText(/^counterparty$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hypothetical quantity/i)).not.toBeInTheDocument();
  });
});
