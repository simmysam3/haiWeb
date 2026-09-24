import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DispositionDialog } from '../disposition-dialog';

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
