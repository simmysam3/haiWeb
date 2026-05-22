import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CadencePicker } from '../../../_components/cadence-picker';
import type { Cadence } from '@haiwave/protocol';

describe('CadencePicker', () => {
  it('renders manual_only by default and emits change to daily', async () => {
    const onChange = vi.fn<(c: Cadence) => void>();
    render(<CadencePicker value={{ kind: 'manual_only' }} onChange={onChange} />);
    expect(screen.getByLabelText(/manual only/i)).toBeChecked();

    await userEvent.click(screen.getByLabelText(/daily/i));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'daily',
      time_of_day: '00:00',
    });
  });

  it('emits weekly with default day + time when weekly is picked', async () => {
    const onChange = vi.fn<(c: Cadence) => void>();
    render(<CadencePicker value={{ kind: 'manual_only' }} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/weekly/i));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'weekly',
      day_of_week: 'mon',
      time_of_day: '00:00',
    });
  });

  it('emits event_triggered with default event_type when picked', async () => {
    const onChange = vi.fn<(c: Cadence) => void>();
    render(<CadencePicker value={{ kind: 'manual_only' }} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText(/event-triggered/i));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'event_triggered',
      event_type: 'new_trading_partner_added',
    });
  });

  it('shows time-of-day input only for daily/weekly cadences', () => {
    const { rerender } = render(
      <CadencePicker value={{ kind: 'manual_only' }} onChange={() => {}} />,
    );
    expect(screen.queryByLabelText(/time of day/i)).toBeNull();

    rerender(<CadencePicker value={{ kind: 'daily', time_of_day: '02:00' }} onChange={() => {}} />);
    expect(screen.getByLabelText(/time of day/i)).toBeInTheDocument();
  });
});
