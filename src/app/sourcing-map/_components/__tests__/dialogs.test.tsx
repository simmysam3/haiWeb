import { describe, it, expect, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DispositionDialog } from '../disposition-dialog';
import { SmDialog } from '../sm-dialog';

describe('DispositionDialog', () => {
  it('is a labelled modal that closes on Escape, offers delete / archive / keep for earlier executions, defaults to archive, and shows an error', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<DispositionDialog open title="Delete Line A base" onCancel={onCancel} onConfirm={onConfirm} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete Line A base' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenLastCalledWith('archive');
    fireEvent.click(screen.getByRole('radio', { name: /Delete them/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenLastCalledWith('delete');
    rerender(<DispositionDialog open title="Delete Line A base" onCancel={vi.fn()} onConfirm={onConfirm} error="Line A base is running." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Line A base is running.');
  });

  it('traps Tab on the real tab sequence, not every radio in a group (only the checked radio is a tab stop)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DispositionDialog open title="Delete Line A base" onCancel={onCancel} onConfirm={onConfirm} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete Line A base' });
    const deleteRadio = screen.getByRole('radio', { name: /Delete them/ });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteRadio);
    deleteRadio.focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(deleteButton);
    expect(dialog.contains(document.activeElement)).toBe(true);
    deleteButton.focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(deleteRadio);
  });
  it('keeps Delete focusable while its request is in flight: aria-busy, and a press sends nothing (LW-a)', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<DispositionDialog open title="Delete Line A base" onCancel={vi.fn()} onConfirm={onConfirm} />);
    const del = screen.getByRole('button', { name: 'Delete' });
    del.focus();
    fireEvent.click(del);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(<DispositionDialog open title="Delete Line A base" onCancel={vi.fn()} onConfirm={onConfirm} busy />);
    expect(del).toHaveAttribute('aria-busy', 'true');
    expect(del).toHaveAttribute('aria-disabled', 'true');
    expect(del).not.toBeDisabled();
    expect(del).toHaveFocus();
    fireEvent.click(del);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('SmDialog focus management (AC 2, WCAG 2.1 AA)', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open</button>
        <SmDialog title="Test dialog" open={open} onClose={() => setOpen(false)}>
          <input aria-label="First field" />
        </SmDialog>
      </div>
    );
  }

  it('moves focus into the dialog on open, and returns focus to the trigger when Escape closes it', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to `returnFocus` when the opener has gone with the close, never to <body> (L141)', () => {
    function Vanishing() {
      const [open, setOpen] = useState(false);
      const [gone, setGone] = useState(false);
      const fallback = useRef<HTMLButtonElement | null>(null);
      return (
        <div>
          <button ref={fallback}>Fallback</button>
          {!gone && <button onClick={() => setOpen(true)}>Open</button>}
          <SmDialog title="Test dialog" open={open} onClose={() => { setOpen(false); setGone(true); }} returnFocus={fallback}>
            <input aria-label="First field" />
          </SmDialog>
        </div>
      );
    }
    render(<Vanishing />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fallback' }));
  });
});

