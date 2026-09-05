// v.1.44 refined-PD: PhantomDemandScopeFields now operates on the
// phantom_demand_bom template scope shape (sku / default_qty / default_target_date /
// vendor_exclude / weeks_to_hold).  All legacy hypothetical_quantity /
// hypothetical_timeline / counterparty tests have been replaced.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhantomDemandScopeFields } from '../phantom-demand-scope-fields';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
});

const BASE = {
  kind: 'phantom_demand_bom' as const,
  sku: '',
  default_qty: 1,
  default_target_date: '',
  vendor_exclude: [] as string[],
  weeks_to_hold: 1,
  catalog_source: { kind: 'own' as const },
  run_mode: 'full' as const,
};

describe('PhantomDemandScopeFields catalog source (v.1.45)', () => {
  it('defaults to own catalog and hides the trading-partner picker', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    const own = screen.getByRole('radio', { name: /my own catalog/i });
    expect(own).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /trading partner/i }),
    ).not.toBeChecked();
    expect(screen.queryByText(/^trading partner$/i)).not.toBeInTheDocument();
  });

  it('switching to a trading partner emits counterparty source and clears the sku', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields value={{ ...BASE, sku: 'HC-9000' }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /trading partner/i }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sku: '',
        catalog_source: { kind: 'counterparty', counterparty_id: '' },
      }),
    );
  });

  it('renders the trading-partner picker when source is counterparty', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, catalog_source: { kind: 'counterparty', counterparty_id: '' } }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('radio', { name: /trading partner/i }),
    ).toBeChecked();
    expect(screen.getByText(/^trading partner$/i)).toBeInTheDocument();
  });
});

describe('PhantomDemandScopeFields run type (v1.55 readiness)', () => {
  it('defaults to the Full BOM run type and offers a Readiness alternative (own catalog)', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /full bom/i })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /readiness/i }),
    ).not.toBeChecked();
  });

  it('emits run_mode=alternates when the Readiness run type is chosen', () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /readiness/i }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ run_mode: 'alternates' }),
    );
  });

  it('shows the Readiness run type as selected when run_mode=alternates', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, run_mode: 'alternates' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: /readiness/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /full bom/i })).not.toBeChecked();
  });

  it('hides the run-type control when a trading partner catalog is selected', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, catalog_source: { kind: 'counterparty', counterparty_id: '' } }}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('radio', { name: /readiness/i }),
    ).not.toBeInTheDocument();
  });
});

describe('PhantomDemandScopeFields (v.1.44 phantom_demand_bom)', () => {
  it('renders the SKU, Default Quantity, Default Target Date, hold-for-weeks and Exclude Vendors labels', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(screen.getByText(/sku/i)).toBeInTheDocument();
    expect(screen.getByText(/default quantity/i)).toBeInTheDocument();
    expect(screen.getByText(/default target date/i)).toBeInTheDocument();
    expect(
      screen.getByText(/save phantom demand request for \(weeks\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/exclude vendors/i)).toBeInTheDocument();
  });

  it('emits default_qty changes preserving scope shape', () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/default quantity/i), {
      target: { value: '250' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'phantom_demand_bom', default_qty: 250 }),
    );
  });

  it('lets the user clear the qty field while editing (no snap-back during input)', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_qty: 12 }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/default quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('does not emit an invalid default_qty while the field is empty', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_qty: 12 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/default quantity/i), {
      target: { value: '' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores the last valid default_qty on blur if left empty', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_qty: 12 }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/default quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('12');
  });

  it('does not emit a negative default_qty (rejects values <= 0)', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_qty: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/default quantity/i), {
      target: { value: '-5' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not emit zero as default_qty', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_qty: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/default quantity/i), {
      target: { value: '0' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits default_target_date as YYYY-MM-DD string from the date input', () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/default target date/i), {
      target: { value: '2026-06-30' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ default_target_date: '2026-06-30' }),
    );
  });

  it('clears default_target_date when the date input is emptied', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, default_target_date: '2026-06-30' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/default target date/i), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ default_target_date: '' }),
    );
  });

  it('renders "No vendor counterparties available" when options list is empty', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(
      screen.getByText(/no vendor counterparties available/i),
    ).toBeInTheDocument();
  });
});

// R-5b interim (owner ruling 2026-09-05): the SKU box suggests from ONE page of
// the partner's catalog. Until server-side search lands, the box says how much
// of the catalog its suggestions cover; a SKU typed exactly is kept (R-5a).
describe('PhantomDemandScopeFields — partner catalog larger than the suggestion page', () => {
  it('says how many products the suggestions cover against the partner total', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/account/partners/vendor-1/catalog/products?')) {
        return new Response(
          JSON.stringify({
            products: [
              { external_product_id: 'CN-1', product_name: 'Connector 1' },
              { external_product_id: 'CN-2', product_name: 'Connector 2' },
            ],
            total: 10421,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, catalog_source: { kind: 'counterparty', counterparty_id: 'vendor-1' } }}
        onChange={vi.fn()}
      />,
    );
    // the partner picker is a combobox too — address the SKU box by its placeholder
    fireEvent.change(screen.getByPlaceholderText(/search by product name or sku/i), { target: { value: 'CN' } });
    await screen.findByText('Connector 2');
    expect(screen.getByText(/suggestions cover the first 2 of 10,421 products/i)).toBeInTheDocument();
  });
});
