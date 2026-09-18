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

  // C1 (review-L7-1, fix round): an override never infers its disclosure. On an
  // Inherited row there is no trust class to resolve a correct default from, so
  // the shortfall control must not be actionable at all until the operator has
  // chosen a disclosure for this row.
  it('C1: does not save when the shortfall control is touched on an Inherited row', () => {
    const onSaveOverride = vi.fn();
    render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={onSaveOverride} />);
    const shortfallSelect = screen.getByLabelText('availability override shortfall quantity');
    expect(shortfallSelect).toBeDisabled();
    fireEvent.change(shortfallSelect, { target: { value: 'true' } });
    expect(onSaveOverride).not.toHaveBeenCalled();
  });

  // C1, second facet: once the operator has chosen a disclosure for the row
  // (so it is now an override, not Inherited), the shortfall control becomes
  // actionable and must forward THAT chosen disclosure — never the registry
  // default the old code invented (c.default_disclosure.trading_pair, which
  // the fixture below pins to 'qualified', deliberately different from the
  // chosen 'declined' so a regression to the default is caught).
  it('C1: once a disclosure is chosen, toggling shortfall sends that disclosure, never the registry default', () => {
    const onSaveOverride = vi.fn();
    const { rerender } = render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={onSaveOverride} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    expect(onSaveOverride).toHaveBeenLastCalledWith({ attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null });

    // Simulate the parent re-rendering once that PUT resolves and the row is now an override.
    const overrides: DisclosurePolicyOverrideRow[] = [{ counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null }];
    rerender(<CounterpartyOverridesPanel classes={classes} overrides={overrides} onSaveOverride={onSaveOverride} />);
    const shortfallSelect = screen.getByLabelText('availability override shortfall quantity');
    expect(shortfallSelect).not.toBeDisabled();
    fireEvent.change(shortfallSelect, { target: { value: 'true' } });
    expect(onSaveOverride).toHaveBeenLastCalledWith({ attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: true });
    // Present control: the registry default this class's trading_pair column carries is 'qualified',
    // not 'declined' — proving the sent value is the operator's own choice, not the registry default.
    expect(classes[0].default_disclosure.trading_pair).toBe('qualified');
  });

  // I2 (review-L7-1, fix round): the override side of PF P5 — a full-replace
  // write must not silently drop a field it didn't touch. Non-empty overrides
  // fixture (the C1 fix's own suite up to here only used overrides={[]}).
  it('I2: changing an existing override disclosure preserves its shortfall flag', () => {
    const onSaveOverride = vi.fn();
    const overrides: DisclosurePolicyOverrideRow[] = [{ counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: true }];
    render(<CounterpartyOverridesPanel classes={classes} overrides={overrides} onSaveOverride={onSaveOverride} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'raw' } });
    expect(onSaveOverride).toHaveBeenCalledWith({ attribute_class_id: 'availability', disclosure: 'raw', disclose_shortfall_quantity: true });
  });
});
