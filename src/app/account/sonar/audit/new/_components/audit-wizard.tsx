'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplateScope } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../../../templates/_lib/system-config';
import { AuditSchedulePicker } from './audit-schedule-picker';
import { AuditScopePicker } from '../../../_components/audit-scope-picker';
import { StepRail, type RailStep } from '../../../_components/step-rail';
import { StepCard } from '../../../_components/step-card';
import { NameField } from '../../../_components/name-field';
import { LifecycleFields } from '../../../_components/lifecycle-fields';
import { ForkIndicator } from './fork-indicator';

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

function emptyAuditScope(): AuditScope {
  return {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: [],
    signal_types: [],
    skus: [],
    depth_limit: 1,
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
 *  4. Recurring cadence → 'Schedule'
 */
export function computeSubmitLabel({
  cadence,
  isForkMode,
  hasSource,
}: {
  cadence: Cadence;
  isForkMode: boolean;
  hasSource: boolean;
}): string {
  if (isForkMode) return 'Create new audit';
  if (cadence.kind === 'manual_only') return hasSource ? 'Run again' : 'Run now';
  return 'Schedule';
}

export function AuditWizard({ source }: { source: SourceRunSummary | null }) {
  const [name, setName] = useState(source?.template_name ?? '');
  const [cadence, setCadence] = useState<Cadence>(
    source?.cadence ?? { kind: 'manual_only' },
  );
  const [scope, setScope] = useState<AuditScope>(
    source ? resolveSourceScope(source) : emptyAuditScope(),
  );
  const [enabled, setEnabled] = useState(source?.enabled ?? true);
  const [retentionDays, setRetentionDays] = useState(
    source?.retention_days ?? 365,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nameError, setNameError] = useState(false);
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

  const willFireImmediately = cadence.kind === 'manual_only';

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: nameError ? 'error' : 'active' },
    { id: 'scope', label: 'Scope', state: 'todo' },
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

    setBusy(true);
    try {
      let templateId: string;

      if (source && source.template_id !== null && !isForkMode) {
        // Reuse existing template — no creation needed.
        templateId = source.template_id;
      } else {
        // Create a new definition (fresh or fork).
        const body: Record<string, unknown> = {
          template_name: name,
          observation_class: 'audit',
          cadence,
          enabled,
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
