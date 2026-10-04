import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { smWorstRatio } from '@/test/contrast';
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

  it('the toolbar text clears 4.5:1 on the canvas in both themes', () => {
    // AA pairs (F18): sm-btn-ghost on the canvas, and the reason line's sm-muted on the canvas
    render(<div className="sm-root"><MapToolbar pathsOpen onHideAll={vi.fn()} unavailable="Available when the run completes." /></div>);
    const group = screen.getByRole('group', { name: 'Map tools' });
    expect(smWorstRatio(within(group).getByRole('button', { name: 'Hide all paths' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(within(group).getByText('Available when the run completes.'))).toBeGreaterThanOrEqual(4.5);
  });
});
