import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WatcherScopePicker } from '../watcher-scope-picker';
import type { WatcherScope } from '@haiwave/protocol';

const empty: WatcherScope = {
  kind: 'watcher',
  authorization_basis: 'bilateral',
  counterparties: [],
  signal_types: ['lead_time_distribution'],
  skus: [],
  depth_limit: 1,
};

describe('<WatcherScopePicker>', () => {
  it('renders signal-type checkboxes with LT/CAP defaults', () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    expect(screen.getByLabelText(/LT/i)).toBeChecked();
  });

  it('toggling a signal-type checkbox calls onChange with the updated set', async () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/CAP/i));
    expect(onChange).toHaveBeenCalled();
    const next = (onChange.mock.calls.at(-1)?.[0] as WatcherScope).signal_types;
    expect(next).toContain('capacity_utilization_band');
  });

  it('depth slider updates depth_limit in onChange', async () => {
    const onChange = vi.fn();
    render(<WatcherScopePicker value={empty} onChange={onChange} />);
    const slider = screen.getByLabelText(/^depth limit$/i) as HTMLInputElement;
    await userEvent.clear(slider);
    await userEvent.type(slider, '3');
    const next = (onChange.mock.calls.at(-1)?.[0] as WatcherScope).depth_limit;
    expect(next).toBe(3);
  });
});
