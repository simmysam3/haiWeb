'use client';

import { useState, useEffect } from 'react';

/**
 * Audit-specific lifecycle picker. Replaces the generic Enabled-checkbox +
 * days-numeric used elsewhere with a retention-first radio: "No retention"
 * (template + runs expire in 30 days) or opt-in retention measured in months
 * (default 12, max 24). New audits are always enabled — the surfaced choice is
 * how long results are kept.
 *
 * Protocol contract is still retention_days; conversion is months × 30. A
 * 30-day retention is interpreted as the "No retention" preset (the same value
 * the preset writes back) so re-runs round-trip cleanly. Any other value maps
 * to opt-in mode with months = round(days / 30).
 */
const DAYS_PER_MONTH = 30;
const NO_RETENTION_DAYS = 30;
const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 24;
const MIN_MONTHS = 1;

export function AuditLifecycleFields({
  retentionDays,
  onRetentionChange,
}: {
  retentionDays: number;
  onRetentionChange: (days: number) => void;
}) {
  const initialMode: 'none' | 'opt_in' =
    retentionDays === NO_RETENTION_DAYS ? 'none' : 'opt_in';
  const initialMonths =
    initialMode === 'opt_in'
      ? Math.min(
          MAX_MONTHS,
          Math.max(MIN_MONTHS, Math.round(retentionDays / DAYS_PER_MONTH)),
        )
      : DEFAULT_MONTHS;

  const [mode, setMode] = useState<'none' | 'opt_in'>(initialMode);
  const [monthsRaw, setMonthsRaw] = useState(String(initialMonths));

  useEffect(() => {
    if (retentionDays === NO_RETENTION_DAYS) {
      setMode('none');
    } else {
      setMode('opt_in');
      setMonthsRaw(
        String(
          Math.min(
            MAX_MONTHS,
            Math.max(MIN_MONTHS, Math.round(retentionDays / DAYS_PER_MONTH)),
          ),
        ),
      );
    }
  }, [retentionDays]);

  function selectNone() {
    setMode('none');
    onRetentionChange(NO_RETENTION_DAYS);
  }

  function selectOptIn() {
    setMode('opt_in');
    const n = Number.parseInt(monthsRaw, 10);
    const clamped = Number.isFinite(n)
      ? Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, n))
      : DEFAULT_MONTHS;
    onRetentionChange(clamped * DAYS_PER_MONTH);
  }

  return (
    <div
      className="flex flex-col gap-3"
      role="radiogroup"
      aria-label="Retention"
    >
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="radio"
          name="audit-retention-mode"
          checked={mode === 'none'}
          onChange={selectNone}
        />
        <span>
          No Retention
          <span className="text-slate"> (expires in 30 days)</span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="radio"
          name="audit-retention-mode"
          checked={mode === 'opt_in'}
          onChange={selectOptIn}
        />
        <span className="flex items-center gap-2">
          Retention:
          <input
            type="number"
            aria-label="Retention (months)"
            value={monthsRaw}
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            disabled={mode !== 'opt_in'}
            onChange={(e) => {
              setMonthsRaw(e.target.value);
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= MIN_MONTHS && n <= MAX_MONTHS) {
                onRetentionChange(n * DAYS_PER_MONTH);
              }
            }}
            className="rounded border border-slate-300 px-2 py-1 text-sm w-16 disabled:bg-slate/10 disabled:text-slate"
          />
          months
        </span>
      </label>
    </div>
  );
}
