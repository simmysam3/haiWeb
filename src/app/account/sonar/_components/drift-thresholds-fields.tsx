'use client';

import { useEffect, useState } from 'react';
import type { WatcherDriftThresholds } from '@haiwave/protocol';

interface Props {
  value: WatcherDriftThresholds;
  onChange: (next: WatcherDriftThresholds) => void;
  /** True when cadence is manual_only — inputs disabled with an explainer. */
  locked: boolean;
}

type RawState = Record<keyof WatcherDriftThresholds, string>;

function toRaw(v: WatcherDriftThresholds): RawState {
  return {
    short_baseline_threshold_days: String(v.short_baseline_threshold_days),
    noise_floor_days: String(v.noise_floor_days),
    severity_warning_pct: String(v.severity_warning_pct),
    severity_critical_pct: String(v.severity_critical_pct),
  };
}

export function DriftThresholdsFields({ value, onChange, locked }: Props) {
  const invalid = value.severity_critical_pct <= value.severity_warning_pct;
  // Raw input state mirrors the parent value but allows the user to clear an
  // input mid-edit without immediately snapping back. We forward a numeric
  // onChange the moment the string parses to a finite number.
  const [raw, setRaw] = useState<RawState>(() => toRaw(value));
  useEffect(() => {
    setRaw(toRaw(value));
  }, [value]);

  const handle =
    (field: keyof WatcherDriftThresholds) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setRaw((prev) => ({ ...prev, [field]: next }));
      if (next === '') return;
      const n = Number(next);
      if (!Number.isFinite(n)) return;
      onChange({ ...value, [field]: n });
    };
  return (
    <div className="space-y-4">
      {locked && (
        <div
          className="rounded border border-slate/20 bg-slate/5 px-4 py-3 text-xs text-slate"
          role="status"
        >
          Drift detection requires a scheduled cadence. Switch the Schedule
          step to daily, weekly, monthly, or event-triggered to configure
          thresholds.
        </div>
      )}
      <p className="text-xs text-slate">
        Thresholds tune which lead-time shifts surface on the Watcher Backlog.
        Drift below the noise floor is suppressed. Severity escalates by
        magnitude (% of the prior value).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Short baseline threshold (days)
          </span>
          <input
            type="number"
            min={1}
            max={365}
            value={raw.short_baseline_threshold_days}
            onChange={handle('short_baseline_threshold_days')}
            disabled={locked}
            aria-label="Short baseline threshold (days)"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate/10 disabled:text-slate"
          />
          <span className="mt-1 block text-[10px] text-slate">
            Below this baseline, every drift fires (low-priority info).
          </span>
        </label>
        <label className="text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Noise floor (days)
          </span>
          <input
            type="number"
            min={1}
            max={30}
            value={raw.noise_floor_days}
            onChange={handle('noise_floor_days')}
            disabled={locked}
            aria-label="Noise floor (days)"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate/10 disabled:text-slate"
          />
          <span className="mt-1 block text-[10px] text-slate">
            Above the short-baseline threshold, drift must be at least this
            many days to fire.
          </span>
        </label>
        <label className="text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Warning %
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={raw.severity_warning_pct}
            onChange={handle('severity_warning_pct')}
            disabled={locked}
            aria-label="Warning %"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate/10 disabled:text-slate"
          />
          <span className="mt-1 block text-[10px] text-slate">
            Degradation drift % that escalates info → warning.
          </span>
        </label>
        <label className="text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Critical %
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={raw.severity_critical_pct}
            onChange={handle('severity_critical_pct')}
            disabled={locked}
            aria-label="Critical %"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate/10 disabled:text-slate"
          />
          <span className="mt-1 block text-[10px] text-slate">
            Degradation drift % that escalates warning → critical.
          </span>
        </label>
      </div>
      {invalid && !locked && (
        <p role="alert" className="text-xs text-rose-700">
          Critical % must exceed Warning %.
        </p>
      )}
    </div>
  );
}
