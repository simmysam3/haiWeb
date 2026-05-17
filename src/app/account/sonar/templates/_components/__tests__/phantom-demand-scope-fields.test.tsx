import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhantomDemandScopeFields } from '../phantom-demand-scope-fields';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify([
        { id: 'cp-1', company_name: 'Great Lakes Hardware', status: 'trading_pair' },
      ]),
      { status: 200 },
    ),
  );
});

const BASE = {
  kind: 'phantom_demand' as const,
  authorization_basis: 'bilateral' as const,
  counterparty: '',
  skus: [] as string[],
  hypothetical_quantity: 1,
  hypothetical_timeline: null as string | null,
};

describe('PhantomDemandScopeFields', () => {
  it('renders the relabeled "Target Delivery Date" and not "Hypothetical Timeline"', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(screen.getByText(/target delivery date/i)).toBeInTheDocument();
    expect(screen.queryByText(/hypothetical timeline/i)).not.toBeInTheDocument();
  });

  it('emits quantity changes preserving scope shape', () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/hypothetical quantity/i), {
      target: { value: '250' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'phantom_demand', hypothetical_quantity: 250 }),
    );
  });

  it('lets the user clear the quantity field while editing (no snap-back)', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 12 }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/hypothetical quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('does not emit an invalid quantity while the field is empty', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 12 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/hypothetical quantity/i), {
      target: { value: '' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clearing then typing a new quantity emits the new value', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 12 }}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/hypothetical quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '5' } });
    expect(input.value).toBe('5');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hypothetical_quantity: 5 }),
    );
  });

  it('restores the last valid quantity on blur if left empty', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 12 }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/hypothetical quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('12');
  });

  it('selecting a counterparty resets skus (D9)', async () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, skus: ['STALE-1'] }}
        onChange={onChange}
      />,
    );
    await userEvent.click(await screen.findByText('Great Lakes Hardware'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ counterparty: 'cp-1', skus: [] }),
    );
  });

  it('emits a UTC-midnight ISO-8601 hypothetical_timeline from the date input', () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/target delivery date/i), {
      target: { value: '2026-06-30' },
    });
    const emitted = onChange.mock.lastCall?.[0].hypothetical_timeline as string;
    expect(emitted).toBe('2026-06-30T00:00:00.000Z');
    expect(Number.isFinite(Date.parse(emitted))).toBe(true);
  });

  it('clearing the date emits null', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_timeline: '2026-06-30T14:30:00.000Z' }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/target delivery date/i), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hypothetical_timeline: null }),
    );
  });

  it('round-trips a stored ISO into the date input (date only, no time)', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_timeline: '2026-06-30T14:30:00.000Z' }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/target delivery date/i) as HTMLInputElement;
    expect(input.value).toBe('2026-06-30');
  });

  it('does not emit a negative quantity (rejects values <= 0)', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/hypothetical quantity/i), {
      target: { value: '-5' },
    });
    // The guard `Number.isInteger(n) && n > 0` must block -5 from propagating.
    // If this regressed to `Number.isFinite(n)`, onChange WOULD be called with
    // hypothetical_quantity: -5, and the first assertion would fail.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not emit zero as a quantity (rejects hypothetical_quantity: 0)', () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/hypothetical quantity/i), {
      target: { value: '0' },
    });
    // `Number.isFinite(0)` is true, so a regression to that guard would call
    // onChange with hypothetical_quantity: 0 and break this assertion.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores the last valid quantity on blur after a negative entry', () => {
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, hypothetical_quantity: 7 }}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/hypothetical quantity/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    // During editing the draft is allowed to sit in the field (same as empty),
    // but blurring must snap back because -5 fails `Number.isInteger(n) || n <= 0`.
    fireEvent.blur(input);
    expect(input.value).toBe('7');
  });
});
