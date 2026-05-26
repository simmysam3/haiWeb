'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplateScope } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../../../templates/_lib/system-config';
import { AuditSchedulePicker, localToUtc } from './audit-schedule-picker';
import { AuditScopePicker } from '../../../_components/audit-scope-picker';
import { StepRail, type RailStep } from '../../../_components/step-rail';
import { StepCard } from '../../../_components/step-card';
import { NameField } from '../../../_components/name-field';
import { AuditLifecycleFields } from './audit-lifecycle-fields';
import { ForkIndicator } from './fork-indicator';

/**
 * Pick a random overnight time (local) and convert to UTC for storage.
 * Hour ∈ {1..5} local, minute ∈ {0, 10, 20, 30, 40, 50} local. The cadence
 * picker still shows the user-friendly local rendering; this default exists
 * so a user who never edits the time still gets a per-template-creation
 * spread instead of N templates all firing at the same moment. (Same-account
 * templates created in one session also get spread, not just cross-user.)
 */
export function randomOvernightDefault(): Cadence {
  const hour = 1 + Math.floor(Math.random() * 5); // 1..5
  const minute = Math.floor(Math.random() * 6) * 10; // 0,10,20,30,40,50
  const local = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { kind: 'daily', time_of_day: localToUtc(local) };
}

export interface SourceRunSummary {
  run_id: string;
  // null for ad-hoc (template-less) re-runs reconstructed from the run's own
  // scope_snapshot — there is no source definition to reuse or fork from, so
  // submitting always creates a fresh definition.
  template_id: string | null;
  template_name: string;
  scope: RunTemplateScope;
  cadence: Cadence;
  enabled: boolean;
  retention_days: number;
}

type AuditScope = Extract<RunTemplateScope, { kind: 'audit' }>;

// Fresh-audit defaults: cadence over manual (matches the new-audit UX bias
// toward standing observations) and 12 months of retention (= 360 days). The
// cadence default time-of-day is randomized per wizard mount — see
// randomOvernightDefault above.
const DEFAULT_RETENTION_DAYS = 360;

function emptyAuditScope(): AuditScope {
  return {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: [],
    signal_types: [],
    skus: [],
    // Default tier depth for new audits. 1 (direct supplier only) was a
    // conservative starting point but routinely undercaptures sub-tier risk —
    // depth 4 surfaces enough of the chain to make the run useful without
    // chewing through the hop budget on a typical catalog.
    depth_limit: 4,
    hop_budget: SYSTEM_AUDIT_HOP_BUDGET,
  };
}

function resolveSourceScope(source: SourceRunSummary): AuditScope {
  // If the source run's scope is an audit scope, use it; otherwise fall back
  // to the empty default.
  if (source.scope.kind === 'audit') {
    return source.scope as AuditScope;
  }
  return emptyAuditScope();
}

/**
 * Pure utility: compute the submit button label.
 *
 * Rules (in priority order):
 *  1. Fork mode (name changed from source) → 'Create new audit'
 *  2. Manual-only cadence + has source (run-again) → 'Run again'
 *  3. Manual-only cadence (fresh) → 'Run now'
 *  4. Recurring cadence + Run-now checked → 'Schedule & run now'
 *  5. Recurring cadence → 'Schedule'
 */
export function computeSubmitLabel({
  cadence,
  isForkMode,
  hasSource,
  runNow,
}: {
  cadence: Cadence;
  isForkMode: boolean;
  hasSource: boolean;
  runNow: boolean;
}): string {
  if (isForkMode) return 'Create new audit';
  if (cadence.kind === 'manual_only') return hasSource ? 'Run again' : 'Run now';
  return runNow ? 'Schedule & run now' : 'Schedule';
}

export function AuditWizard({ source }: { source: SourceRunSummary | null }) {
  const [name, setName] = useState(source?.template_name ?? '');
  // Lazy initializer: the random default is computed once per wizard mount
  // (and only when there's no source to inherit from). Without lazy init the
  // random would be re-evaluated on every render and React would see "same
  // initial value, no-op" anyway — but lazy makes the intent explicit.
  const [cadence, setCadence] = useState<Cadence>(
    () => source?.cadence ?? randomOvernightDefault(),
  );
  const [scope, setScope] = useState<AuditScope>(
    source ? resolveSourceScope(source) : emptyAuditScope(),
  );
  const [retentionDays, setRetentionDays] = useState(
    source?.retention_days ?? DEFAULT_RETENTION_DAYS,
  );
  // Default-on for fresh audits so users see results immediately after
  // configuring; meaningless in manual mode (the picker hides the checkbox).
  const [runNow, setRunNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const router = useRouter();

  // Fork mode: a source DEFINITION exists (template_id non-null) + name has
  // been changed from the source template name. Template-less ad-hoc re-runs
  // (template_id null) are never "fork" — there is no definition to fork from;
  // they always create a fresh definition on submit.
  const isForkMode =
    !!source &&
    source.template_id !== null &&
    name.trim() !== '' &&
    name !== source.template_name;

  function revertName() {
    if (source) setName(source.template_name);
  }

  // Triggers an immediate run if: manual cadence (no schedule, so a run is the
  // whole point), or cadence + the Run-now checkbox.
  const willFireImmediately =
    cadence.kind === 'manual_only' || runNow;

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: nameError ? 'error' : 'active' },
    { id: 'scope', label: 'Scope', state: scopeError ? 'error' : 'todo' },
    { id: 'schedule', label: 'Schedule', state: 'todo' },
    { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
  ];

  function jump(id: string) {
    const el = document.getElementById(`step-${id}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function submit() {
    setError(null);
    setSessionExpired(false);

    if (name.trim().length === 0) {
      setNameError(true);
      setError('Name is required.');
      jump('identity');
      return;
    }
    setNameError(false);

    // Spec §5.5: bilateral audit scope must include ≥1 counterparty + ≥1 SKU.
    // key_scoped basis is gated separately by AuditScopePicker's text input.
    if (scope.authorization_basis === 'bilateral') {
      if (scope.counterparties.length === 0 || scope.skus.length === 0) {
        setScopeError(true);
        setError(
          scope.counterparties.length === 0 && scope.skus.length === 0
            ? 'Audit scope: pick at least one counterparty and one SKU.'
            : scope.counterparties.length === 0
              ? 'Audit scope: pick at least one counterparty.'
              : 'Audit scope: pick at least one SKU.',
        );
        jump('scope');
        return;
      }
    }
    setScopeError(false);

    setBusy(true);
    try {
      let templateId: string;

      if (source && source.template_id !== null && !isForkMode) {
        // Reuse existing template — no creation needed.
        templateId = source.template_id;
      } else {
        // Create a new definition (fresh or fork). enabled is always true for
        // new audits — the surfaced lifecycle choice is retention, not on/off.
        const body: Record<string, unknown> = {
          template_name: name,
          observation_class: 'audit',
          cadence,
          enabled: true,
          retention_days: retentionDays,
          scope,
          ...(source ? { source_run_id: source.run_id } : {}),
        };
        const res = await fetch('/api/account/sonar/audit/definitions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const info = await describeApiError(res);
          setError(info.message);
          setSessionExpired(info.sessionExpired);
          return;
        }
        const payload = (await res.json().catch(() => null)) as
          | { template?: { template_id?: string } }
          | null;
        const newId = payload?.template?.template_id;
        if (!newId) {
          setError(
            'Audit configuration was created but the server response was malformed. Refresh the list to confirm.',
          );
          return;
        }
        templateId = newId;
      }

      if (willFireImmediately) {
        // Trigger an immediate run.
        const runRes = await fetch(
          `/api/account/sonar/audit/definitions/${templateId}/run`,
          { method: 'POST' },
        );
        if (!runRes.ok) {
          const info = await describeApiError(runRes);
          setError(info.message);
          setSessionExpired(info.sessionExpired);
          return;
        }
        const runPayload = (await runRes.json().catch(() => null)) as
          | { run_id?: string }
          | null;
        const runId = runPayload?.run_id;
        if (!runId) {
          setError(
            'Audit run was triggered but the server response was malformed. Check the audit history to confirm.',
          );
          return;
        }
        router.push(`/account/sonar/audit/${runId}`);
      } else {
        router.push(`/account/sonar/audit/definitions/${templateId}`);
      }
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = computeSubmitLabel({
    cadence,
    isForkMode,
    hasSource: !!source,
    runNow,
  });

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-2xl">
        <StepCard
          id="identity"
          index={0}
          title="Identity"
          accent={isForkMode ? 'orange' : undefined}
        >
          <NameField noun="Audit" value={name} onChange={setName} />
          {isForkMode && (
            <ForkIndicator
              sourceName={source!.template_name}
              onRevert={revertName}
            />
          )}
        </StepCard>

        <StepCard id="scope" index={1} title="Audit Scope">
          <AuditScopePicker value={scope} onChange={setScope} />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
<<<<<<< HEAD
          <AuditSchedulePicker value={cadence} onChange={setCadence} />
          {/* v.1.42 composite gap rollup — clarify what flows into the
              Backlog. Only Cadence (recurring: daily/weekly) audits
              contribute their most-recent run to the composite Gaps view;
              Manual audits run on demand and stay out of the rollup. */}
          <p className="mt-3 text-xs text-slate">
            Only <strong>Cadence</strong> audits feed the{' '}
            <strong>Backlog</strong> — each scheduled template contributes its
            most-recent run. <strong>Manual</strong> audits run on demand and
            don&apos;t appear in the Backlog rollup.
          </p>
=======
          <AuditSchedulePicker
            value={cadence}
            onChange={setCadence}
            runNow={runNow}
            onRunNowChange={setRunNow}
          />
>>>>>>> 45b2258 (feat(audit-new): cadence-first schedule + Run-now checkbox + months retention)
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          <AuditLifecycleFields
            retentionDays={retentionDays}
            onRetentionChange={setRetentionDays}
          />
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={[
              'rounded text-white px-4 py-1.5 text-sm font-medium disabled:opacity-60',
              isForkMode
                ? 'bg-orange hover:bg-orange/90'
                : 'bg-teal hover:bg-teal/90',
            ].join(' ')}
          >
            {busy ? 'Submitting…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
