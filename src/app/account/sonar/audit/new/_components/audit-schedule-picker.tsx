'use client';

import type { Cadence } from '@haiwave/protocol';

interface Props {
  value: Cadence;
  onChange: (next: Cadence) => void;
}

const DAY_OPTIONS = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
] as const;

type DayOfWeek = (typeof DAY_OPTIONS)[number]['value'];
type Freq = 'daily' | 'weekly';

/**
 * Audit-specific schedule picker. Top-level choice is Manual vs Cadence
 * (Manual is the default and is NOT a cadence). Selecting Cadence reveals the
 * recurring config: a frequency row (Daily / Weekly — the only backend-backed
 * recurring cadences today) and a parameter row (Time of day always; Day of
 * week only for Weekly). Event-triggered is intentionally not offered here.
 */
export function AuditSchedulePicker({ value, onChange }: Props) {
  const isManual = value.kind === 'manual_only';
  const freq: Freq = value.kind === 'weekly' ? 'weekly' : 'daily';
  const timeOfDay = 'time_of_day' in value ? value.time_of_day : '00:00';
  const dayOfWeek: DayOfWeek =
    value.kind === 'weekly' ? (value.day_of_week as DayOfWeek) : 'mon';

  function selectFreq(next: Freq) {
    if (next === 'weekly') {
      onChange({ kind: 'weekly', day_of_week: dayOfWeek, time_of_day: timeOfDay });
    } else {
      onChange({ kind: 'daily', time_of_day: timeOfDay });
    }
  }

  return (
    <div className="space-y-4">
      {/* Top-level run mode — Manual (default) vs Cadence, on one row. */}
      <div className="flex items-center gap-6" role="radiogroup" aria-label="Run mode">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="audit-run-mode"
            checked={isManual}
            onChange={() => onChange({ kind: 'manual_only' })}
          />
          Manual
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="audit-run-mode"
            checked={!isManual}
            onChange={() => selectFreq(freq)}
          />
          Cadence
        </label>
      </div>

      {/* Recurring config — only shown when Cadence is selected. */}
      {!isManual && (
        <div className="rounded-lg border border-slate/15 bg-slate/5 p-4 space-y-4">
          <div
            className="flex flex-wrap items-center gap-6"
            role="radiogroup"
            aria-label="Frequency"
          >
            {(['daily', 'weekly'] as Freq[]).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="audit-cadence-freq"
                  checked={freq === f}
                  onChange={() => selectFreq(f)}
                />
                {f === 'daily' ? 'Daily' : 'Weekly'}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">Time of day (UTC start)</span>
              <input
                type="time"
                aria-label="Time of day (UTC start)"
                value={timeOfDay}
                onChange={(e) =>
                  onChange(
                    freq === 'weekly'
                      ? { kind: 'weekly', day_of_week: dayOfWeek, time_of_day: e.target.value }
                      : { kind: 'daily', time_of_day: e.target.value },
                  )
                }
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>

            {freq === 'weekly' && (
              <label className="block text-sm text-charcoal">
                <span className="block mb-1 font-medium">Day of week</span>
                <select
                  aria-label="Day of week"
                  value={dayOfWeek}
                  onChange={(e) =>
                    onChange({
                      kind: 'weekly',
                      day_of_week: e.target.value as DayOfWeek,
                      time_of_day: timeOfDay,
                    })
                  }
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
