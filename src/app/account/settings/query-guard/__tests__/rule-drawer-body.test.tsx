import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleDrawerBody } from '../_components/rule-drawer-body';
import type { CellRule } from '../_components/guard-rules-matrix';

const cell: CellRule = {
  rule_type: 'sku_repeat',
  trust_class: 'unknown',
  window: 'day',
  threshold: 10,
  origin_filter: 'any',
  actions: [{ type: 'alert', email: null }],
  enabled: true,
  source: 'default',
  rule_id: null,
};

function renderDrawer() {
  const onSave = vi.fn();
  render(
    <RuleDrawerBody
      cell={cell}
      defaultAlertEmail={null}
      saving={false}
      canReset={false}
      onSave={onSave}
      onReset={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return { onSave };
}

const save = () => screen.getByRole('button', { name: /save/i });

describe('RuleDrawerBody validation', () => {
  it('disables Save when the threshold is cleared or non-positive', () => {
    renderDrawer();
    const threshold = screen.getByLabelText('Threshold');
    expect(save()).toBeEnabled();
    fireEvent.change(threshold, { target: { value: '' } });
    expect(save()).toBeDisabled();
    fireEvent.change(threshold, { target: { value: '0' } });
    expect(save()).toBeDisabled();
    fireEvent.change(threshold, { target: { value: '5' } });
    expect(save()).toBeEnabled();
  });

  it('disables Save when no action is selected (a rule must do something on trip)', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Alert')); // uncheck the only action
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Log'));
    expect(save()).toBeEnabled();
  });

  it('disables Save when pause is checked with an invalid duration', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Pause'));
    const minutes = screen.getByLabelText('Pause duration (minutes)');
    expect(save()).toBeEnabled(); // default 60 is valid
    fireEvent.change(minutes, { target: { value: '' } });
    expect(save()).toBeDisabled();
    fireEvent.change(minutes, { target: { value: '30' } });
    expect(save()).toBeEnabled();
  });

  it('saved pause duration is the parsed number from the input', () => {
    const { onSave } = renderDrawer();
    fireEvent.click(screen.getByLabelText('Pause'));
    fireEvent.change(screen.getByLabelText('Pause duration (minutes)'), { target: { value: '30' } });
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([{ type: 'pause', duration_minutes: 30 }]),
      }),
    );
  });
});
