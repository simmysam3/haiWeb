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
