import { describe, it, expect, vi, fireEvent } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScopePicker } from '../scope-picker';
import type { RunTemplateScope } from '@haiwave/protocol';

describe('ScopePicker — audit', () => {
  it('renders depth-limit + hop-budget inputs for company scope and emits changes', async () => {
    const onChange = vi.fn<(s: RunTemplateScope) => void>();
    render(
      <ScopePicker
        observationClass="audit"
        value={{
          kind: 'audit',
          authorization_basis: 'bilateral',
          counterparties: [],
          signal_types: [],
          skus: [],
          depth_limit: 1,
          hop_budget: 5,
        }}
        onChange={onChange}
      />,
    );
    const depth = screen.getByLabelText(/depth limit/i) as HTMLInputElement;
    expect(depth.value).toBe('1');
    await userEvent.clear(depth);
    await userEvent.type(depth, '3');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ depth_limit: 3 }),
    );
  });

  it('toggles between company and key scope types', async () => {
    const onChange = vi.fn<(s: RunTemplateScope) => void>();
    render(
      <ScopePicker
        observationClass="audit"
        value={{
          kind: 'audit',
          authorization_basis: 'bilateral',
          counterparties: [],
          signal_types: [],
          skus: [],
          depth_limit: 1,
          hop_budget: 5,
        }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText(/provenance key/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'audit',
        authorization_basis: 'key_scoped',
        provenance_key_id: '',
        depth_limit: 1,
        hop_budget: 5,
      }),
    );
  });
});

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
  it('renders PD scope picker with counterparty + SKU + quantity + timeline', () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        observationClass="phantom_demand"
        value={{
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: '',
          skus: [],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText(/Counterparty/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SKUs/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hypothetical Quantity/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hypothetical Timeline/)).toBeInTheDocument();
  });

  it('emits a PhantomDemandScope-shaped value on counterparty change', async () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        observationClass="phantom_demand"
        value={{
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: '',
          skus: [],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        }}
        onChange={onChange}
      />,
    );
    // fireEvent.change gives us a single call with the full value
    const cpInput = screen.getByLabelText(/Counterparty/);
    await userEvent.clear(cpInput);
    await userEvent.type(cpInput, 'cp1');
    // Check that at some point onChange was called with a PD-shaped value
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'phantom_demand',
        authorization_basis: 'bilateral',
      }),
    );
  });
});
