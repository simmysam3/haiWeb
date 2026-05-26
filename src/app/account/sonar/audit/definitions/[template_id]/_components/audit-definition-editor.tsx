'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplate } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { AuditSchedulePicker } from '../../../new/_components/audit-schedule-picker';
import { StepRail, type RailStep } from '../../../../_components/step-rail';
import { StepCard } from '../../../../_components/step-card';
import { ScopeSummary } from '../../../../templates/_components/scope-summary';
import { NameField } from '../../../../_components/name-field';
import { LifecycleFields } from '../../../../_components/lifecycle-fields';

const steps: RailStep[] = [
  { id: 'identity', label: 'Identity', state: 'active' },
  { id: 'scope', label: 'Scope', state: 'locked' },
  { id: 'schedule', label: 'Schedule', state: 'todo' },
  { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
];

export function AuditDefinitionEditor({ template }: { template: RunTemplate }) {
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
      const res = await fetch(
        `/api/account/sonar/audit/definitions/${template.template_id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            template_name: name,
            cadence,
            enabled,
            retention_days: retentionDays,
          }),
        },
      );
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
   * Reactivating resumes the schedule from the next cadence tick.
   */
  async function toggleEnabled() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(
        `/api/account/sonar/audit/definitions/${template.template_id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        },
      );
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
        `Delete audit definition "${template.template_name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/audit/definitions/${template.template_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.push('/account/sonar/audit');
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
            aria-label={enabled ? 'Audit is active' : 'Audit is suspended'}
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
            Paused — scheduled runs are suspended and this audit is excluded
            from the Backlog rollup. Run history is preserved. Reactivate to
            resume the schedule.
          </div>
        )}
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun="Audit" value={name} onChange={setName} />
        </StepCard>

        <StepCard id="scope" index={1} title="Audit Scope" locked>
          <ScopeSummary scope={template.scope} />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <AuditSchedulePicker value={cadence} onChange={setCadence} />
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          <LifecycleFields
            enabled={enabled}
            retentionDays={retentionDays}
            onEnabledChange={setEnabled}
            onRetentionChange={setRetentionDays}
          />
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
