'use client';

import { useEffect, useState } from 'react';
import type { WatcherDriftThresholds } from '@haiwave/protocol';
import { DEFAULT_WATCHER_DRIFT_THRESHOLDS } from '@haiwave/protocol';
import { DetailChevron } from '@/components/sonar/observations';

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
    // v1.69 slice D — promise-slip severity, in DAYS a committed line's
    // completion date moved (read server-side by the drift evaluator).
    promise_slip_warning_days: String(v.promise_slip_warning_days),
    promise_slip_critical_days: String(v.promise_slip_critical_days),
  };
}

function isDefault(v: WatcherDriftThresholds): boolean {
  return (
    v.short_baseline_threshold_days ===
      DEFAULT_WATCHER_DRIFT_THRESHOLDS.short_baseline_threshold_days &&
    v.noise_floor_days === DEFAULT_WATCHER_DRIFT_THRESHOLDS.noise_floor_days &&
    v.severity_warning_pct ===
      DEFAULT_WATCHER_DRIFT_THRESHOLDS.severity_warning_pct &&
    v.severity_critical_pct ===
      DEFAULT_WATCHER_DRIFT_THRESHOLDS.severity_critical_pct &&
    v.promise_slip_warning_days ===
      DEFAULT_WATCHER_DRIFT_THRESHOLDS.promise_slip_warning_days &&
    v.promise_slip_critical_days ===
      DEFAULT_WATCHER_DRIFT_THRESHOLDS.promise_slip_critical_days
  );
}

/**
 * Plain-English restatement of what the current thresholds actually cause the
 * watcher to fire on. Always visible (collapsed or expanded) so the operator
 * can read the *behavior* rather than reverse-engineer it from six numbers —
 * the original four plus the v1.69 slice D promise_slip_warning_days /
 * promise_slip_critical_days pair — and so it updates live while the knobs
 * are open.
 */
function DriftSummary({ value }: { value: WatcherDriftThresholds }) {
  return (
    <ul className="space-y-2 text-sm text-charcoal">
      <li className="flex gap-2">
        <span aria-hidden className="select-none text-slate">
          •
        </span>
        <span>
          <span className="font-semibold">New counterparties.</span> Until a
          counterparty has at least{' '}
          <span className="font-semibold text-navy">
            {value.short_baseline_threshold_days} days
          </span>{' '}
          of lead-time history, every change is surfaced — but only as
          low-priority <span className="font-medium">info</span>, since there
          isn&apos;t a stable baseline to judge it against yet.
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden className="select-none text-slate">
          •
        </span>
        <span>
          <span className="font-semibold">Small wobbles are ignored.</span>{' '}
          Once a baseline is established, a lead time has to move by at least{' '}
          <span className="font-semibold text-navy">
            {value.noise_floor_days} days
          </span>{' '}
          before it&apos;s flagged at all. Anything smaller is treated as noise
          and stays silent.
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden className="select-none text-slate">
          •
        </span>
        <span>
          <span className="font-semibold">Severity follows the slip.</span> A
          lead time getting{' '}
          <span className="font-semibold text-amber-700">
            {value.severity_warning_pct}% worse
          </span>{' '}
          is raised to <span className="font-medium">Warning</span>;{' '}
          <span className="font-semibold text-rose-700">
            {value.severity_critical_pct}% worse
          </span>{' '}
          is raised to <span className="font-medium">Critical</span>.
          Improvements and smaller slips remain informational.
        </span>
      </li>
      <li className="flex gap-2">
        <span aria-hidden className="select-none text-slate">
          •
        </span>
        <span>
          <span className="font-semibold">Promise dates.</span> A committed
          order line whose completion date slips{' '}
          <span className="font-semibold text-amber-700">
            {value.promise_slip_warning_days} days
          </span>{' '}
          is raised to <span className="font-medium">Warning</span>;{' '}
          <span className="font-semibold text-rose-700">
            {value.promise_slip_critical_days} days
          </span>{' '}
          is raised to <span className="font-medium">Critical</span>. There is
          no noise floor here — a promise is a commitment, not a measurement —
          so any change to a promised schedule is at least recorded as info.
        </span>
      </li>
    </ul>
  );
}

export function DriftThresholdsFields({ value, onChange, locked }: Props) {
  const invalid = value.severity_critical_pct <= value.severity_warning_pct;
  const slipInvalid =
    value.promise_slip_critical_days <= value.promise_slip_warning_days;
  // Collapsed by default — the summary above tells the whole story and most
  // watchers ride the defaults. Auto-open only when the saved values are
  // invalid, so the inline error can't hide behind a collapsed section.
  const [expanded, setExpanded] = useState(invalid || slipInvalid);
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

  const usingDefaults = isDefault(value);

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

      <p className="text-sm text-slate">
        Drift detection decides which lead-time changes are worth your
        attention and how loudly to flag them on the Watcher Backlog. With the
        {usingDefaults ? ' default ' : ' current '}sensitivity:
      </p>

      <DriftSummary value={value} />

      {!locked && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="group inline-flex items-center gap-2 text-sm font-medium text-teal hover:underline"
        >
          Alter drift thresholds
          <DetailChevron expanded={false} />
        </button>
      )}

      {!locked && expanded && (
        <div className="rounded-lg border border-slate/15 bg-slate/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate">
              Drift thresholds
            </span>
            <div className="flex items-center gap-3">
              {!usingDefaults && (
                <button
                  type="button"
                  onClick={() => onChange(DEFAULT_WATCHER_DRIFT_THRESHOLDS)}
                  className="text-xs text-teal hover:underline"
                >
                  Reset to defaults
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-expanded
                className="group inline-flex items-center gap-1.5 text-xs font-medium text-slate hover:text-charcoal"
              >
                Done
                <DetailChevron expanded />
              </button>
            </div>
          </div>
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
                aria-label="Short baseline threshold (days)"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                How much history a counterparty needs before drift is judged
                against a baseline. Under it, every change fires as info.
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
                aria-label="Noise floor (days)"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                Smallest day-over-day shift that&apos;s worth flagging.
                Anything below this is treated as noise and ignored.
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
                aria-label="Warning %"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                How much worse a lead time has to get to escalate from info to
                a Warning.
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
                aria-label="Critical %"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                How much worse a lead time has to get to escalate from a Warning
                to Critical.
              </span>
            </label>
            <label className="text-sm text-charcoal">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
                Promise slip warning (days)
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={raw.promise_slip_warning_days}
                onChange={handle('promise_slip_warning_days')}
                aria-label="Promise slip warning (days)"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                How many days a committed order line&apos;s completion date has
                to slip before it&apos;s raised to a Warning. Smaller slips are
                still recorded as info.
              </span>
            </label>
            <label className="text-sm text-charcoal">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
                Promise slip critical (days)
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={raw.promise_slip_critical_days}
                onChange={handle('promise_slip_critical_days')}
                aria-label="Promise slip critical (days)"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="mt-1 block text-[10px] text-slate">
                A slip of this many days or more is raised to Critical.
              </span>
            </label>
          </div>
          {invalid && (
            <p role="alert" className="text-xs text-rose-700">
              Critical % must exceed Warning %.
            </p>
          )}
          {slipInvalid && (
            <p role="alert" className="text-xs text-rose-700">
              Promise slip critical must exceed promise slip warning.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
