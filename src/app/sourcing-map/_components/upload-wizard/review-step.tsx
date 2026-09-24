// src/app/sourcing-map/_components/upload-wizard/review-step.tsx
'use client';
import type { RowError } from '@/lib/sourcing-map/upload/bom-rows';
import { SmButton } from '../sm-button';

/** Spec §7.3 step 4: counts, per-row errors with source rows; nothing is saved until Review passes. */
export function ReviewStep({ summary, errors, ignoredColumns, commitLabel, busy, error, onBack, onCommit }: {
  summary: string[]; errors: RowError[]; ignoredColumns: string[]; commitLabel: string; busy: boolean; error: string | null;
  onBack(): void; onCommit(): void;
}) {
  const rowErrors = [...errors].sort((a, b) => a.row - b.row);
  return (
    <div>
      <ul className="text-sm">{summary.map((s) => <li key={s}>{s}</li>)}</ul>
      {ignoredColumns.length > 0 && (
        <p className="sm-warn mt-2 text-sm">Ignored columns (no matching size): {ignoredColumns.join(', ')}</p>
      )}
      {rowErrors.length > 0 && (
        <div role="alert" className="mt-3">
          <p className="sm-error text-sm">Fix these rows in the file and upload it again. Nothing has been saved.</p>
          <ul className="sm-error mt-1 list-disc pl-5 text-sm">
            {rowErrors.map((e, i) => <li key={`${e.row}-${i}`}>{e.message}</li>)}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
      <div className="mt-4 flex justify-between">
        {/* A save in flight answers on this step: Back would strand a failure's message on Resolve (a-G4), or close the dialog. */}
        <button type="button" className="sm-btn sm-btn-ghost" disabled={busy} onClick={onBack}>Back</button>
        <SmButton className="sm-btn sm-btn-primary" busy={busy} disabled={rowErrors.length > 0} onClick={onCommit}>{commitLabel}</SmButton>
      </div>
    </div>
  );
}
