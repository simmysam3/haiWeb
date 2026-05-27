'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplate, RunTemplateEvent } from '@haiwave/protocol';
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
}

export function DefinitionEditor({
  template,
  events = [],
  observationClass,
  scopePicker,
  endpointBase,
  listRoute,
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

  const dirty = useMemo(
    () =>
      name !== template.template_name ||
      enabled !== template.enabled ||
      retentionDays !== template.retention_days ||
      JSON.stringify(cadence) !== JSON.stringify(template.cadence),
    [name, enabled, retentionDays, cadence, template],
  );

  function jump(id: string) {
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(`${endpointBase}/${template.template_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template_name: name,
          cadence,
          enabled,
          retention_days: retentionDays,
        }),
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

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-2xl">
        {/* v.1.42 — Activation status + Suspend/Reactivate. Lives above the
            step chain so a paused template is obvious without scrolling, and
            the toggle saves immediately (separate from the form dirty-state
            save bar). Suspended templates drop out of the composite Backlog
            rollup but keep their history and can be reactivated later. */}
        <div className="mb-4 flex items-center gap-3">
          <span
            className={
              enabled
                ? 'inline-flex items-center rounded-full bg-teal/15 px-2.5 py-0.5 text-xs font-semibold text-teal-dark'
                : 'inline-flex items-center rounded-full bg-slate/15 px-2.5 py-0.5 text-xs font-semibold text-slate'
            }
            aria-label={
              enabled
                ? `${noun} is active`
                : `${noun} is suspended`
            }
          >
            {enabled ? 'Active' : 'Suspended'}
          </span>
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={busy}
            className={
              enabled
                ? 'rounded border border-slate/30 px-3 py-1 text-xs text-slate hover:border-slate hover:text-charcoal disabled:opacity-60'
                : 'rounded border border-teal text-teal-dark px-3 py-1 text-xs font-semibold hover:bg-teal/10 disabled:opacity-60'
            }
          >
            {enabled ? 'Suspend' : 'Reactivate'}
          </button>
        </div>
        {!enabled && (
          <div
            role="status"
            className="mb-4 rounded border border-slate/20 bg-slate/5 px-4 py-3 text-xs text-slate"
          >
            Paused — scheduled runs are suspended and this {noun.toLowerCase()} is
            excluded from the Backlog rollup. Run history is preserved. Reactivate
            to resume the schedule.
          </div>
        )}
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun={noun} value={name} onChange={setName} />
        </StepCard>

        <StepCard id="scope" index={1} title={scopeTitle} locked>
          {scopePicker}
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <SchedulePicker value={cadence} onChange={setCadence} />
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
