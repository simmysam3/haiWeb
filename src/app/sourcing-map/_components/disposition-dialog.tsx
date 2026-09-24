'use client';
import { useState } from 'react';
import { SmButton } from './sm-button';
import { SmDialog } from './sm-dialog';

export type Disposition = 'delete' | 'archive' | 'keep';

const OPTIONS: Array<{ value: Disposition; label: string }> = [
  { value: 'archive', label: 'Archive them (hidden from lists, never deleted)' },
  { value: 'keep', label: 'Keep them (still listed, under their saved name)' },
  { value: 'delete', label: 'Delete them' },
];

/** D-206: what happens to earlier executions when a run or project is deleted (spec §8.9, AC 3, AC 19). */
export function DispositionDialog({ open, title, onCancel, onConfirm, busy = false, error = null }: {
  open: boolean; title: string; onCancel(): void; onConfirm(d: Disposition): void; busy?: boolean; error?: string | null;
}) {
  const [choice, setChoice] = useState<Disposition>('archive');
  return (
    <SmDialog
      title={title}
      open={open}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="sm-btn sm-btn-ghost" onClick={onCancel}>Cancel</button>
          <SmButton className="sm-btn sm-btn-primary" busy={busy} onClick={() => onConfirm(choice)}>Delete</SmButton>
        </>
      }
    >
      <fieldset>
        <legend className="sm-muted text-sm">Earlier executions</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="disposition" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} />
            {o.label}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
    </SmDialog>
  );
}
