'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplate, RunTemplateEvent, RunTemplateScope } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { SchedulePicker } from './schedule-picker';
import { StepRail, type RailStep } from './step-rail';
import { StepCard } from './step-card';
import { NameField } from './name-field';
import { AuditLifecycleFields } from './audit-lifecycle-fields';

const steps: RailStep[] = [
  { id: 'identity', label: 'Identity', state: 'active' },
  { id: 'scope', label: 'Scope', state: 'locked' },
  { id: 'schedule', label: 'Schedule', state: 'todo' },
  { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
  // v.1.42 — unnumbered (read-only) entry in the rail. StepRail renders the
  // ordinal from index+1; setting `state: 'locked'` styles it as inert and
  // we suppress the numeric ordinal via the StepCard's `index={-1}`.
  { id: 'history', label: 'History', state: 'locked' },
];

const EVENT_LABEL: Record<RunTemplateEvent['event_kind'], string> = {
  created: 'Created',
  suspended: 'Suspended',
  reactivated: 'Reactivated',
};

// v.1.42 — Renders the lifecycle event log. Lightweight by design: one row
// per event, newest-first, formatted as 'Suspended · 2026-05-26 14:32 ·
// authorized by <actor>'. Suspended events also get a leading dim badge
// so the audit-trail-relevant row is scannable from a long history.
function HistoryList({ events }: { events: RunTemplateEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs italic text-slate">
        No lifecycle events recorded yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2 text-sm">
      {events.map((e) => {
        const when = new Date(e.at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        return (
          <li
            key={e.event_id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate/10 pb-2 last:border-0"
          >
            <span
              className={
                e.event_kind === 'suspended'
                  ? 'inline-flex items-center rounded-full bg-slate/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate'
                  : e.event_kind === 'reactivated'
                  ? 'inline-flex items-center rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-dark'
                  : 'inline-flex items-center rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange'
              }
            >
              {EVENT_LABEL[e.event_kind]}
            </span>
            <span className="text-charcoal">{when}</span>
            <span className="text-slate">
              {e.event_kind === 'suspended' ? 'Authorized by ' : 'By '}
              <span className="font-mono text-xs">
                {e.actor_user_id ?? 'system'}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

const NOUN_BY_CLASS: Record<ObservationClass, string> = {
  audit: 'Audit',
  watcher: 'Watcher',
  phantom_demand: 'Phantom Demand',
};

const SCOPE_TITLE_BY_CLASS: Record<ObservationClass, string> = {
  audit: 'Audit Scope',
  watcher: 'Watcher Scope',
  phantom_demand: 'Phantom Demand Scope',
};

interface Props {
  template: RunTemplate;
  // v.1.42 — lifecycle history fetched server-side in the page wrapper.
  // Empty array is a valid state (template predates this surface, or BFF
  // fetch failed open).
  events?: RunTemplateEvent[];
  /**
   * Modality discriminator. Selects nouns and copy. Plan 2 will use this to
   * select scope-write protocol variants too.
   */
  observationClass: ObservationClass;
  /**
   * Slot for the modality's scope surface (read-only summary or interactive
   * picker — caller's choice). Audit passes a read-only `<ScopeSummary>`;
   * Plan 2 watcher will pass an interactive `<WatcherScopePicker>`.
   */
  scopePicker: ReactNode;
  /**
   * API endpoint base, e.g. `/api/account/sonar/audit/definitions`. The
   * editor PATCH/DELETEs `${endpointBase}/${template_id}`.
   */
  endpointBase: string;
  /** Route to push to after delete, e.g. `/account/sonar/audit`. */
  listRoute: string;
  /**
   * Whether the Scope step's StepCard is locked (read-only). Audit defaults
   * to true. Watcher passes false so the scope step is editable.
   */
  scopeLocked?: boolean;
  /**
   * Current scope value when scopeLocked is false. Caller owns scope state
   * (the scopePicker is the caller's component that wires value/onChange).
   * Ignored when scopeLocked is true.
   */
  scopeValue?: RunTemplateScope;
  /**
   * Called when scope is saved. Only invoked when scopeLocked is false; the
   * caller-owned scope state is included in the PATCH body during the dirty-
   * form save flow. Ignored when scopeLocked is true.
   */
  onScopeChange?: (next: RunTemplateScope) => void;
}

export function DefinitionEditor({
  template,
  events = [],
  observationClass,
  scopePicker,
  endpointBase,
  listRoute,
  scopeLocked = true,
  scopeValue,
}: Props) {
  const noun = NOUN_BY_CLASS[observationClass];
  const scopeTitle = SCOPE_TITLE_BY_CLASS[observationClass];

  const [name, setName] = useState(template.template_name);
  const [cadence, setCadence] = useState<Cadence>(template.cadence);
  const [enabled, setEnabled] = useState(template.enabled);
  const [retentionDays, setRetentionDays] = useState(template.retention_days);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setName(template.template_name);
    setCadence(template.cadence);
    setEnabled(template.enabled);
    setRetentionDays(template.retention_days);
  }, [template]);

  const scopeDirty = !scopeLocked && scopeValue !== undefined
    ? JSON.stringify(scopeValue) !== JSON.stringify(template.scope)
    : false;

  const dirty = useMemo(
    () =>
      name !== template.template_name ||
      enabled !== template.enabled ||
      retentionDays !== template.retention_days ||
      JSON.stringify(cadence) !== JSON.stringify(template.cadence) ||
      scopeDirty,
    [name, enabled, retentionDays, cadence, template, scopeDirty],
  );

  function jump(id: string) {
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const patchBody: Record<string, unknown> = {
        template_name: name,
        cadence,
        enabled,
        retention_days: retentionDays,
      };
      if (!scopeLocked && scopeValue !== undefined) {
        patchBody.scope = scopeValue;
      }
      const res = await fetch(`${endpointBase}/${template.template_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * v.1.42 — Suspend/Reactivate. Flips `enabled` immediately via PATCH,
   * independent of the dirty-form save bar. A suspended template still
   * exists, retains run history, and is excluded from the composite
   * gap rollup (collectGaps filters to enabled=true active templates).
   */
  async function toggleEnabled() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(`${endpointBase}/${template.template_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      setEnabled(next);
      router.refresh();
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete ${noun.toLowerCase()} definition "${template.template_name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${endpointBase}/${template.template_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.push(listRoute);
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * v.1.43 follow-up — Suspend/Reactivate moved into the Schedule step as a
   * radio group (Active / Suspended). The top-of-page status pill + standalone
   * toggle button were noisy when the template wasn't on a schedule; surfacing
   * the control alongside cadence makes the relationship explicit. The setter
   * still PATCHes immediately, independent of the dirty-form save bar.
   */
  async function setEnabledTo(next: boolean) {
    if (next === enabled) return;
    await toggleEnabled();
  }

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-2xl">
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun={noun} value={name} onChange={setName} />
        </StepCard>

        <StepCard id="scope" index={1} title={scopeTitle} locked={scopeLocked}>
          {scopePicker}
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <SchedulePicker value={cadence} onChange={setCadence} />
          <fieldset className="mt-5 border-t border-slate/10 pt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate">
              Activation
            </legend>
            <p className="mt-1 text-xs text-slate">
              Suspended {noun.toLowerCase()}s keep their history but drop out of
              the schedule and the Backlog rollup. Reactivate any time.
            </p>
            <div role="radiogroup" aria-label="Activation" className="mt-3 flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="activation"
                  value="active"
                  checked={enabled}
                  disabled={busy}
                  onChange={() => setEnabledTo(true)}
                  className="text-teal focus:ring-teal"
                />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="radio"
                  name="activation"
                  value="suspended"
                  checked={!enabled}
                  disabled={busy}
                  onChange={() => setEnabledTo(false)}
                  className="text-teal focus:ring-teal"
                />
                Suspended
              </label>
            </div>
          </fieldset>
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          {/* Enabled/disabled lives on the header Suspend/Reactivate button —
              the Lifecycle step surfaces only retention here, matching the
              new-audit wizard. */}
          <AuditLifecycleFields
            retentionDays={retentionDays}
            onRetentionChange={setRetentionDays}
          />
        </StepCard>

        {/* v.1.42 — Unnumbered History step sits at the bottom of the rail.
            Pure read-only render over the event log fetched server-side. */}
        <StepCard id="history" index={-1} title="History" unnumbered>
          <HistoryList events={events} />
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded border border-rose-400 text-rose-700 px-3 py-1.5 text-sm hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>

        {dirty && (
          <div className="sticky bottom-0 mt-4 bg-navy text-white rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm">Unsaved changes</span>
            <button
              type="button"
              onClick={save}
              disabled={busy || name.trim().length === 0}
              className="rounded bg-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-orange/90 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
