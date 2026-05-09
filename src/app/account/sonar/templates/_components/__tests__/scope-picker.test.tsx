import { describe, it, expect, vi } from 'vitest';
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
          scope_type: 'company',
          scope_ids: [],
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
          scope_type: 'company',
          scope_ids: [],
          depth_limit: 1,
          hop_budget: 5,
        }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText(/provenance key/i));
    expect(onChange).toHaveBeenCalledWith({
      scope_type: 'key',
      provenance_key_id: '',
      depth_limit: 1,
      hop_budget: 5,
    });
  });
});

describe('ScopePicker — watcher', () => {
  it('renders signal_types checkboxes for watcher scope', async () => {
    const onChange = vi.fn<(s: RunTemplateScope) => void>();
    render(
      <ScopePicker
        observationClass="watcher"
        value={{
          scope_type: 'watcher',
          signal_types: ['lead_time_distribution'],
          counterparty_filter: null,
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
