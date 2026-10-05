import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { smWorstRatio } from '@/test/contrast';
import { MapToolbar } from '../map-toolbar';

describe('MapToolbar', () => {
  it('Hide all paths is unavailable, never disabled, with nothing open: it keeps focus and a press does nothing; with a path open one press calls onHideAll', () => {
    const onHideAll = vi.fn();
    const { rerender } = render(<MapToolbar pathsOpen={false} onHideAll={onHideAll} unavailable={null} heat onHeat={vi.fn()} />);
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
    rerender(<MapToolbar pathsOpen onHideAll={onHideAll} unavailable={null} heat onHeat={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide all paths' }));
    expect(onHideAll).toHaveBeenCalledTimes(1);
  });

  it('the heat switch says its state in its label and in aria-pressed, and a press asks for the other', () => {
    const onHeat = vi.fn();
    const { rerender } = render(<MapToolbar pathsOpen={false} onHideAll={vi.fn()} unavailable={null} heat onHeat={onHeat} />);
    const group = screen.getByRole('group', { name: 'Map tools' });
    const on = within(group).getByRole('button', { name: 'Heat on links: on' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(on);
    expect(onHeat).toHaveBeenLastCalledWith(false);
    rerender(<MapToolbar pathsOpen={false} onHideAll={vi.fn()} unavailable={null} heat={false} onHeat={onHeat} />);
    const off = within(group).getByRole('button', { name: 'Heat on links: off' });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(off);
    expect(onHeat).toHaveBeenLastCalledWith(true);
  });

  it('the toolbar text clears 4.5:1 on the canvas in both themes', () => {
    // AA pairs (F18): sm-btn-ghost on the canvas, and the reason line's sm-muted on the canvas
    render(<div className="sm-root"><MapToolbar pathsOpen onHideAll={vi.fn()} unavailable="Available when the run completes." heat onHeat={vi.fn()} /></div>);
    const group = screen.getByRole('group', { name: 'Map tools' });
    expect(smWorstRatio(within(group).getByRole('button', { name: 'Hide all paths' }))).toBeGreaterThanOrEqual(4.5);
    expect(smWorstRatio(within(group).getByText('Available when the run completes.'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the heat switch label clears 4.5:1 on the canvas in both themes', () => {
    // AA pair (F18): sm-btn-ghost on the canvas, the pair the toolbar's other button asserts; the switch adds no new pair
    render(<div className="sm-root"><MapToolbar pathsOpen onHideAll={vi.fn()} unavailable={null} heat onHeat={vi.fn()} /></div>);
    const group = screen.getByRole('group', { name: 'Map tools' });
    expect(smWorstRatio(within(group).getByRole('button', { name: 'Heat on links: on' }))).toBeGreaterThanOrEqual(4.5);
  });
});
