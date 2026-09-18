import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CounterpartyOverridesPanel } from '../counterparty-overrides-panel';
import type { AttributeClassSummary, DisclosurePolicyOverrideRow } from '@/lib/safe-room-types';

const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const classes: AttributeClassSummary[] = [{
  attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted',
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' },
}];

describe('CounterpartyOverridesPanel', () => {
  it('marks a class inherited with no override row, and overridden with one', () => {
    const { rerender } = render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={vi.fn()} />);
    expect(screen.getByText('Inherited')).toBeInTheDocument();
    const overrides: DisclosurePolicyOverrideRow[] = [{ counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null }];
    rerender(<CounterpartyOverridesPanel classes={classes} overrides={overrides} onSaveOverride={vi.fn()} />);
    expect(screen.getByText('Override')).toBeInTheDocument();
    expect(screen.queryByText('Inherited')).not.toBeInTheDocument();
  });

  it('saves an override with no trust_class key', () => {
    const onSaveOverride = vi.fn();
    render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={onSaveOverride} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    expect(onSaveOverride).toHaveBeenCalledWith({ attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null });
    expect(onSaveOverride.mock.calls[0][0]).not.toHaveProperty('trust_class');
  });
});
