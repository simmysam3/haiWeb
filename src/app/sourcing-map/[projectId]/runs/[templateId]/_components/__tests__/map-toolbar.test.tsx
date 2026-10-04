import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MapToolbar } from '../map-toolbar';

describe('MapToolbar', () => {
  it('Hide all paths is unavailable, never disabled, with nothing open: it keeps focus and a press does nothing; with a path open one press calls onHideAll', () => {
    const onHideAll = vi.fn();
    const { rerender } = render(<MapToolbar pathsOpen={false} onHideAll={onHideAll} unavailable={null} />);
    const group = screen.getByRole('group', { name: 'Map tools' });
    const hide = within(group).getByRole('button', { name: 'Hide all paths' });
    expect(hide).toHaveAttribute('title', 'Closes every open path and trace (Esc)');
    // nothing open: unavailable (w3), with its title only
    expect(hide).toHaveAttribute('aria-disabled', 'true');
    expect(hide).not.toBeDisabled();
    hide.focus();
    fireEvent.click(hide);
    expect(hide).toHaveFocus();
    expect(onHideAll).not.toHaveBeenCalled();
    // a path open: one press calls onHideAll
    rerender(<MapToolbar pathsOpen onHideAll={onHideAll} unavailable={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide all paths' }));
    expect(onHideAll).toHaveBeenCalledTimes(1);
  });
});
