import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisclosurePolicyMatrix } from '../disclosure-policy-matrix';
import { RoomParticipationPanel } from '../room-participation-panel';
import type { AttributeClassSummary, DisclosurePolicyRow } from '@/lib/safe-room-types';

const classes: AttributeClassSummary[] = [{
  attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted',
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' },
}];

describe('DisclosurePolicyMatrix', () => {
  it('shows the registry default when no participant row exists', () => {
    render(<DisclosurePolicyMatrix classes={classes} rows={[]} onSave={vi.fn()} />);
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('qualified');
  });

  it('prefers a participant row over the registry default', () => {
    const rows: DisclosurePolicyRow[] = [{ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: false, source: 'participant' }];
    render(<DisclosurePolicyMatrix classes={classes} rows={rows} onSave={vi.fn()} />);
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('raw');
  });

  // PF P5 — the write is full-replace, so a disclosure change must carry the flag the cell already had.
  it('changing a cell disclosure preserves its disclose_shortfall_quantity', () => {
    const onSave = vi.fn();
    const rows: DisclosurePolicyRow[] = [{ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'qualified', disclose_shortfall_quantity: true, source: 'participant' }];
    render(<DisclosurePolicyMatrix classes={classes} rows={rows} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    expect(onSave).toHaveBeenCalledWith({ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: true });
  });

  it('toggling the per-cell shortfall flag sends the whole cell, disclosure included', () => {
    const onSave = vi.fn();
    render(<DisclosurePolicyMatrix classes={classes} rows={[]} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('availability disclose shortfall quantity for trading_pair'));
    expect(onSave).toHaveBeenCalledWith({ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'qualified', disclose_shortfall_quantity: true });
  });
});

describe('RoomParticipationPanel', () => {
  it('reads the global switch from the participation state', () => {
    const onToggleParticipation = vi.fn();
    render(<RoomParticipationPanel classes={classes} participation={{ global: true, per_class: {} }} onToggleParticipation={onToggleParticipation} />);
    fireEvent.click(screen.getByLabelText('Participate in the evaluation room (all classes)'));
    expect(onToggleParticipation).toHaveBeenCalledWith(null, false);
  });

  it('falls back to the global value for a class absent from per_class', () => {
    render(<RoomParticipationPanel classes={classes} participation={{ global: false, per_class: {} }} onToggleParticipation={vi.fn()} />);
    expect(screen.getByLabelText('Participate in the evaluation room for Availability')).not.toBeChecked();
  });
});
