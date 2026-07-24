'use client';

import { useState } from 'react';
import type {
  QueryGuardAction,
  QueryGuardOriginFilter,
  QueryGuardWindow,
} from '@haiwave/protocol';
import { Button } from '@/components';
import type { CellRule } from './guard-rules-matrix';

export interface RuleFormValue {
  window: QueryGuardWindow;
  threshold: number;
  originFilter: QueryGuardOriginFilter;
  actions: QueryGuardAction[];
  enabled: boolean;
}

const WINDOWS: QueryGuardWindow[] = ['hour', 'day', 'week'];
const ORIGIN_FILTERS: QueryGuardOriginFilter[] = ['any', 'ad_hoc', 'scheduled'];

interface ActionState {
  alert: boolean;
  alertEmail: string;
  pause: boolean;
  pauseMinutes: string;
  log: boolean;
  block: boolean;
}

function toActionState(actions: QueryGuardAction[]): ActionState {
  const alert = actions.find((a) => a.type === 'alert');
  const pause = actions.find((a) => a.type === 'pause');
  return {
    alert: alert !== undefined,
    alertEmail: alert && alert.type === 'alert' ? (alert.email ?? '') : '',
    pause: pause !== undefined,
    pauseMinutes: pause && pause.type === 'pause' ? String(pause.duration_minutes) : '60',
    log: actions.some((a) => a.type === 'log'),
    block: actions.some((a) => a.type === 'block'),
  };
}

function toActions(state: ActionState): QueryGuardAction[] {
  const actions: QueryGuardAction[] = [];
  if (state.alert) {
    actions.push({ type: 'alert', email: state.alertEmail.trim() === '' ? null : state.alertEmail.trim() });
  }
  if (state.pause) {
    actions.push({ type: 'pause', duration_minutes: Number(state.pauseMinutes) });
  }
  if (state.log) actions.push({ type: 'log' });
  if (state.block) actions.push({ type: 'block' });
  return actions;
}

/**
 * Per-cell edit form for the query-guard rules matrix drawer. Threshold uses
 * the raw-string input pattern (drift-thresholds-fields idiom) so a cleared
 * input doesn't snap back mid-edit; the numeric value is parsed at save
 * time. The window select is hidden for excess_volume (that rule has no
 * window — it compares against the largest historic order).
 */
export function RuleDrawerBody({
  cell,
  defaultAlertEmail,
  saving,
  canReset,
  onSave,
  onReset,
  onClose,
}: {
  cell: CellRule;
  defaultAlertEmail: string | null;
  saving: boolean;
  canReset: boolean;
  onSave: (form: RuleFormValue) => Promise<void> | void;
  onReset: () => Promise<void> | void;
  onClose: () => void;
}) {
  const isExcessVolume = cell.rule_type === 'excess_volume';
  const [rawThreshold, setRawThreshold] = useState(String(cell.threshold));
  const [windowValue, setWindow] = useState<QueryGuardWindow>(cell.window ?? 'day');
  const [originFilter, setOriginFilter] = useState<QueryGuardOriginFilter>(cell.origin_filter);
  const [actionState, setActionState] = useState<ActionState>(() => toActionState(cell.actions));
  const [enabled, setEnabled] = useState(cell.enabled);

  const thresholdValue = Number(rawThreshold);
  const thresholdValid =
    rawThreshold !== '' && Number.isInteger(thresholdValue) && thresholdValue > 0;
  const pauseMinutesValue = Number(actionState.pauseMinutes);
  const pauseValid =
    !actionState.pause ||
    (actionState.pauseMinutes !== '' && Number.isInteger(pauseMinutesValue) && pauseMinutesValue > 0);
  const hasAction = actionState.alert || actionState.pause || actionState.log || actionState.block;
  const canSave = thresholdValid && pauseValid && hasAction && !saving;

  return (
    <div className="space-y-5">
      <label className="block text-sm text-charcoal">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
          {isExcessVolume ? 'Threshold (% over largest historic order)' : 'Threshold'}
        </span>
        <input
          type="number"
          min={1}
          value={rawThreshold}
          onChange={(e) => setRawThreshold(e.target.value)}
          aria-label="Threshold"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>

      {!isExcessVolume && (
        <label className="block text-sm text-charcoal">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
            Window
          </span>
          <select
            value={windowValue}
            onChange={(e) => setWindow(e.target.value as QueryGuardWindow)}
            aria-label="Window"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm text-charcoal">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
          Origin filter
        </span>
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as QueryGuardOriginFilter)}
          aria-label="Origin filter"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {ORIGIN_FILTERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-charcoal mb-2">Actions</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={actionState.alert}
              onChange={() => setActionState((s) => ({ ...s, alert: !s.alert }))}
              aria-label="Alert"
            />
            <span className="text-sm text-charcoal">Alert</span>
          </label>
          {actionState.alert && (
            <input
              type="email"
              value={actionState.alertEmail}
              onChange={(e) => setActionState((s) => ({ ...s, alertEmail: e.target.value }))}
              placeholder={defaultAlertEmail ?? 'in-app only'}
              aria-label="Alert email"
              className="ml-6 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={actionState.pause}
              onChange={() => setActionState((s) => ({ ...s, pause: !s.pause }))}
              aria-label="Pause"
            />
            <span className="text-sm text-charcoal">Pause</span>
          </label>
          {actionState.pause && (
            <label className="ml-6 block text-sm text-charcoal">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate">
                Pause duration (minutes)
              </span>
              <input
                type="number"
                min={1}
                value={actionState.pauseMinutes}
                onChange={(e) => setActionState((s) => ({ ...s, pauseMinutes: e.target.value }))}
                aria-label="Pause duration (minutes)"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={actionState.log}
              onChange={() => setActionState((s) => ({ ...s, log: !s.log }))}
              aria-label="Log"
            />
            <span className="text-sm text-charcoal">Log</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={actionState.block}
              onChange={() => setActionState((s) => ({ ...s, block: !s.block }))}
              aria-label="Block"
            />
            <span className="text-sm text-charcoal">Block</span>
          </label>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => setEnabled((v) => !v)}
          aria-label="Enabled"
        />
        <span className="text-sm text-charcoal">Enabled</span>
      </label>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate/15">
        {canReset ? (
          <button
            type="button"
            onClick={() => onReset()}
            disabled={saving}
            className="text-sm text-teal hover:underline disabled:opacity-50"
          >
            Reset to default
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                window: windowValue,
                threshold: thresholdValue,
                originFilter,
                actions: toActions(actionState),
                enabled,
              })
            }
            disabled={!canSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
