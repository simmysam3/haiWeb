'use client';

import type { Cadence } from '@haiwave/protocol';

interface CadencePickerProps {
  value: Cadence;
  onChange: (next: Cadence) => void;
}

const KIND_LABELS = {
  manual_only: 'Manual only',
  daily: 'Daily',
  weekly: 'Weekly',
  event_triggered: 'Event-triggered',
} as const;

const DAY_OPTIONS: { value: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }[] = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
];

const EVENT_OPTIONS: { value: 'new_trading_partner_added' | 'partner_trust_class_changed'; label: string }[] = [
  { value: 'new_trading_partner_added', label: 'New trading partner added' },
  { value: 'partner_trust_class_changed', label: 'Partner trust class changed' },
];

export function CadencePicker({ value, onChange }: CadencePickerProps) {
  function selectKind(kind: Cadence['kind']) {
    if (kind === 'manual_only') {
      onChange({ kind: 'manual_only' });
    } else if (kind === 'daily') {
      onChange({ kind: 'daily', time_of_day: '00:00' });
    } else if (kind === 'weekly') {
      onChange({ kind: 'weekly', day_of_week: 'mon', time_of_day: '00:00' });
    } else {
      onChange({ kind: 'event_triggered', event_type: 'new_trading_partner_added' });
    }
  }

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-charcoal">Cadence</legend>
        {(Object.keys(KIND_LABELS) as Cadence['kind'][]).map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="radio"
              name="cadence-kind"
              checked={value.kind === kind}
              onChange={() => selectKind(kind)}
            />
            {KIND_LABELS[kind]}
          </label>
        ))}
      </fieldset>

      {(value.kind === 'daily' || value.kind === 'weekly') && (
        <label className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium">Time of day (UTC)</span>
          <input
            type="time"
            value={value.time_of_day}
            onChange={(e) =>
              onChange({ ...value, time_of_day: e.target.value } as Cadence)
            }
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      )}

      {value.kind === 'weekly' && (
        <label className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium">Day of week</span>
          <select
            value={value.day_of_week}
            onChange={(e) =>
              onChange({
                kind: 'weekly',
                day_of_week: e.target.value as 'mon',
                time_of_day: value.time_of_day,
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

      {value.kind === 'event_triggered' && (
        <label className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium">Event type</span>
          <select
            value={value.event_type}
            onChange={(e) =>
              onChange({
                kind: 'event_triggered',
                event_type: e.target.value as 'new_trading_partner_added',
              })
            }
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {EVENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
