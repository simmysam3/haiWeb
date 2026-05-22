import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepRail } from '../../../_components/step-rail';

const steps = [
  { id: 'identity', label: 'Identity', state: 'done' as const },
  { id: 'scope', label: 'Scope', state: 'locked' as const },
  { id: 'schedule', label: 'Schedule', state: 'active' as const },
  { id: 'lifecycle', label: 'Lifecycle', state: 'error' as const },
];

describe('StepRail', () => {
  it('renders every step label', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    for (const s of steps) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });

  it('marks the active step with aria-current', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('calls onJump with the step id when a step is clicked', async () => {
    const onJump = vi.fn();
    render(<StepRail steps={steps} onJump={onJump} />);
    await userEvent.click(screen.getByRole('button', { name: /Identity/ }));
    expect(onJump).toHaveBeenCalledWith('identity');
  });

  it('locked step announces its locked state', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Scope.*locked/i }),
    ).toBeInTheDocument();
  });
});
