'use client';

import type { Cadence } from '@haiwave/protocol';

/**
 * Shared schedule picker for sonar observation configurations (audit, watcher,
 * phantom demand). Top-level choice is Cadence (recurring) vs Manual. Selecting
 * Cadence reveals the recurring config (frequency + time-of-day / day-of-week /
 * day-of-month) plus an optional Run-now checkbox. Event-triggered is not
 * offered.
 *
 * Lifted from the audit-specific version with no behavioral change. See spec
 * §3.2 + §7.3.
 */

// Protocol stores `time_of_day` as UTC HH:MM. The picker shows it in the
// user's browser-local time so they can reason in their own clock. The
// conversion uses TODAY's date, which means a schedule that straddles a DST
// boundary will appear to shift by one hour in local time across the
// boundary — the stored UTC stays constant, so the cadence is "fires at the
// same UTC moment every day," not "fires at the same local wall-clock time."
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function utcToLocal(utcHHMM: string): string {
  const [h, m] = utcHHMM.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return utcHHMM;
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function localToUtc(localHHMM: string): string {
  const [h, m] = localHHMM.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return localHHMM;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

interface Props {
  value: Cadence;
  onChange: (next: Cadence) => void;
  // Optional Run-now affordance — only the new-audit wizard wires this. The
  // editor (definitions/[id]) reuses the picker without it, since "run now"
  // already lives on the run-history step there.
  runNow?: boolean;
  onRunNowChange?: (next: boolean) => void;
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
type Freq = 'daily' | 'weekly' | 'monthly';

// day_of_month is bounded at 1-28 to match the protocol (see
// CadenceMonthlySchema): every calendar month gets exactly one fire, no
// surprise-skipped months for users who picked 29-31.
const MONTHLY_DAY_MIN = 1;
const MONTHLY_DAY_MAX = 28;
const DEFAULT_DAY_OF_MONTH = 1;

export function SchedulePicker({
  value,
  onChange,
  runNow,
  onRunNowChange,
}: Props) {
  const isManual = value.kind === 'manual_only';
  const freq: Freq =
    value.kind === 'weekly'
      ? 'weekly'
      : value.kind === 'monthly'
        ? 'monthly'
        : 'daily';
  const timeOfDay = 'time_of_day' in value ? value.time_of_day : '00:00';
  const dayOfWeek: DayOfWeek =
    value.kind === 'weekly' ? (value.day_of_week as DayOfWeek) : 'mon';
  const dayOfMonth: number =
    value.kind === 'monthly' ? value.day_of_month : DEFAULT_DAY_OF_MONTH;

  function selectFreq(next: Freq) {
    if (next === 'weekly') {
      onChange({ kind: 'weekly', day_of_week: dayOfWeek, time_of_day: timeOfDay });
    } else if (next === 'monthly') {
      onChange({ kind: 'monthly', day_of_month: dayOfMonth, time_of_day: timeOfDay });
    } else {
      onChange({ kind: 'daily', time_of_day: timeOfDay });
    }
  }

  return (
    <div className="space-y-4">
      {/* Top-level run mode — Cadence (default, first) vs Manual. */}
      <div className="flex items-center gap-6" role="radiogroup" aria-label="Run mode">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="sonar-run-mode"
            checked={!isManual}
            onChange={() => selectFreq(freq)}
          />
          Cadence
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="radio"
            name="sonar-run-mode"
            checked={isManual}
            onChange={() => onChange({ kind: 'manual_only' })}
          />
          Manual
        </label>
      </div>

      {/* Recurring config + Run-now — only shown when Cadence is selected. */}
      {!isManual && (
        <div className="rounded-lg border border-slate/15 bg-slate/5 p-4 space-y-4">
          <div
            className="flex flex-wrap items-center gap-6"
            role="radiogroup"
            aria-label="Frequency"
          >
            {(['daily', 'weekly', 'monthly'] as Freq[]).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="sonar-cadence-freq"
                  checked={freq === f}
                  onChange={() => selectFreq(f)}
                />
                {f === 'daily' ? 'Daily' : f === 'weekly' ? 'Weekly' : 'Monthly'}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm text-charcoal">
              <span className="block mb-1 font-medium">Time of day (your local time)</span>
              <input
                type="time"
                aria-label="Time of day (your local time)"
                value={utcToLocal(timeOfDay)}
                onChange={(e) => {
                  const t = localToUtc(e.target.value);
                  if (freq === 'weekly') {
                    onChange({ kind: 'weekly', day_of_week: dayOfWeek, time_of_day: t });
                  } else if (freq === 'monthly') {
                    onChange({ kind: 'monthly', day_of_month: dayOfMonth, time_of_day: t });
                  } else {
                    onChange({ kind: 'daily', time_of_day: t });
                  }
                }}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="block text-xs text-slate mt-0.5">Fires at {timeOfDay} UTC.</span>
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

            {freq === 'monthly' && (
              <label className="block text-sm text-charcoal">
                <span className="block mb-1 font-medium">Day of month</span>
                <input
                  type="number"
                  aria-label="Day of month"
                  min={MONTHLY_DAY_MIN}
                  max={MONTHLY_DAY_MAX}
                  value={dayOfMonth}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    if (
                      Number.isFinite(n) &&
                      n >= MONTHLY_DAY_MIN &&
                      n <= MONTHLY_DAY_MAX
                    ) {
                      onChange({
                        kind: 'monthly',
                        day_of_month: n,
                        time_of_day: timeOfDay,
                      });
                    }
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
                />
                <span className="block text-xs text-slate mt-0.5">
                  1–28; later days are excluded so every month fires.
                </span>
              </label>
            )}
          </div>

          {onRunNowChange && (
            <div className="border-t border-slate/15 pt-3">
              <label className="flex items-start gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={!!runNow}
                  onChange={(e) => onRunNowChange(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Run now</span>
                  <span className="block text-xs text-slate mt-0.5">
                    Kick off the first pass today. Subsequent updates will follow the cadence above.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
