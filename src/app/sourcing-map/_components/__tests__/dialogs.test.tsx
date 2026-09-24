import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
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
});
