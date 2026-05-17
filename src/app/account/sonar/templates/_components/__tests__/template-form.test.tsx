import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NameField, LifecycleFields } from '../template-form';

describe('NameField', () => {
  it('renders the labelled input and reports changes', async () => {
    const onChange = vi.fn();
    render(<NameField noun="Audit" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });
});

describe('LifecycleFields', () => {
  it('toggles enabled and edits retention', async () => {
    const onEnabled = vi.fn();
    const onRetention = vi.fn();
    render(
      <LifecycleFields
        enabled
        retentionDays={365}
        onEnabledChange={onEnabled}
        onRetentionChange={onRetention}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /enabled/i }));
    expect(onEnabled).toHaveBeenCalledWith(false);
    const ret = screen.getByLabelText(/retention/i);
    await userEvent.clear(ret);
    await userEvent.type(ret, '90');
    expect(onRetention).toHaveBeenLastCalledWith(90);
  });
});
