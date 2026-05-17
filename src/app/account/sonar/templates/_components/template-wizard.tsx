'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Cadence,
  CreateRunTemplateRequest,
  RunTemplateScope,
} from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { configNoun } from '../_lib/config-noun';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../_lib/system-config';
import { CadencePicker } from './cadence-picker';
import { ScopePicker } from './scope-picker';
import { StepRail, type RailStep } from './step-rail';
import { StepCard } from './step-card';
import { NameField, LifecycleFields } from './template-form';

type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

function emptyScope(oc: ObservationClass): RunTemplateScope {
  if (oc === 'audit') {
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
  if (oc === 'watcher') {
    return {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['lead_time_distribution'],
      depth_limit: 1,
    };
  }
  return {
    kind: 'phantom_demand',
    authorization_basis: 'bilateral',
    counterparty: '',
    skus: [],
    hypothetical_quantity: 1,
    hypothetical_timeline: null,
  };
}

export function TemplateWizard({
  defaultObservationClass,
}: {
  defaultObservationClass?: ObservationClass;
}) {
  const [observationClass, setObservationClass] = useState<ObservationClass>(
    defaultObservationClass ?? 'audit',
  );
  const noun = configNoun(observationClass);
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<Cadence>({ kind: 'manual_only' });
  const [scope, setScope] = useState<RunTemplateScope>(
    emptyScope(observationClass),
  );
  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(365);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nameError, setNameError] = useState(false);
  const router = useRouter();

  function changeObservationClass(next: ObservationClass) {
    setObservationClass(next);
    setScope(emptyScope(next));
  }

  const pdIncomplete =
    observationClass === 'phantom_demand' &&
    scope.kind === 'phantom_demand' &&
    (scope.counterparty.length === 0 || scope.skus.length === 0);

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: nameError ? 'error' : 'active' },
    { id: 'scope', label: 'Scope', state: pdIncomplete ? 'error' : 'todo' },
    { id: 'schedule', label: 'Schedule', state: 'todo' },
    { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
  ];

  function jump(id: string) {
    const el = document.getElementById(`step-${id}`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function create() {
    setError(null);
    setSessionExpired(false);
    if (name.length === 0) {
      setNameError(true);
      setError('Name is required.');
      jump('identity');
      return;
    }
    setNameError(false);
    if (pdIncomplete) {
      setError('Phantom demand requires a counterparty and at least one SKU.');
      jump('scope');
      return;
    }
    setBusy(true);
    try {
      const body = {
        template_name: name,
        observation_class: observationClass,
        cadence,
        enabled,
        retention_days: retentionDays,
        scope,
      } as CreateRunTemplateRequest;
      const res = await fetch('/api/account/sonar/templates', {
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
          `${noun} was created but the server response was malformed. Refresh the list to confirm.`,
        );
        return;
      }
      router.push(`/account/sonar/templates/${newId}`);
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
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun={noun} value={name} onChange={setName} />
          <label className="block text-sm text-charcoal mt-3">
            <span className="block mb-1 font-medium" id="modality-label">
              Modality
            </span>
            <select
              aria-labelledby="modality-label"
              aria-label="Modality"
              value={observationClass}
              onChange={(e) =>
                changeObservationClass(e.target.value as ObservationClass)
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="audit">Audit</option>
              <option value="watcher">Watcher</option>
              <option value="phantom_demand">Phantom Demand</option>
            </select>
          </label>
        </StepCard>

        <StepCard id="scope" index={1} title="Scope">
          <ScopePicker
            observationClass={observationClass}
            value={scope}
            onChange={setScope}
          />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <CadencePicker value={cadence} onChange={setCadence} />
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
            onClick={create}
            disabled={busy}
            className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
