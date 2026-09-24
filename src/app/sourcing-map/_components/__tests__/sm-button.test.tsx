import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmButton } from '../sm-button';

describe('SmButton (LW-a, WCAG 2.4.3)', () => {
  it('while busy it is aria-disabled and aria-busy, never disabled, keeps focus, and ignores a press', () => {
    const onClick = vi.fn();
    const { rerender } = render(<SmButton className="sm-btn" onClick={onClick}>Save</SmButton>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    button.focus();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('aria-busy');

    rerender(<SmButton className="sm-btn" busy onClick={onClick}>Save</SmButton>);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    // `disabled` would move focus to <body> in a browser (HTML's focus-fixup rule; jsdom does not apply it).
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
