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
import { ScopePicker } from './scope-picker';
import { StepRail, type RailStep } from '../../_components/step-rail';
import { StepCard } from '../../_components/step-card';
import { NameField } from '../../_components/name-field';
import { LifecycleFields } from '../../_components/lifecycle-fields';

// This wizard creates phantom-demand configurations only. Audits are created
// via /audit/new (v.1.40) and watchers via /watchers/new (v.1.43 Plan 2); the
// /templates/new page redirects any watcher entry point to that dedicated
// wizard. There is therefore no modality choice here — the single modality is
// phantom_demand.
const OBSERVATION_CLASS = 'phantom_demand' as const;

function emptyScope(): RunTemplateScope {
  // v.1.44 refined-PD: emit the new BOM template scope shape.
  // No authorization_basis — PhantomDemandBomTemplateScopeSchema does not carry it.
  return {
    kind: 'phantom_demand_bom',
    sku: '',
    default_qty: 1,
    default_target_date: '', // ISO YYYY-MM-DD; filled in by the user
    vendor_exclude: [],
    weeks_to_hold: 1,
    // v.1.45 — default to the initiator's own catalog (BOM-explosion run).
    catalog_source: { kind: 'own' },
    // v1.55 — default to a full BOM run; the user opts into readiness.
    run_mode: 'full',
  } as RunTemplateScope;
}

export function TemplateWizard() {
  const noun = configNoun(OBSERVATION_CLASS);
  const [name, setName] = useState('');
  // Phantom-demand configurations are manual-execution only — there is no
  // scheduling step, so the cadence is fixed to manual_only.
  const cadence: Cadence = { kind: 'manual_only' };
  const [scope, setScope] = useState<RunTemplateScope>(emptyScope());
  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(365);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nameError, setNameError] = useState(false);
  const router = useRouter();

  // v.1.44 refined-PD: incomplete when sku is empty (the one required field).
  // v.1.45: a counterparty-catalog source also requires a selected partner —
  // an empty counterparty_id would fail the server's uuid validation.
  const pdNeedsPartner =
    scope.kind === 'phantom_demand_bom' &&
    scope.catalog_source?.kind === 'counterparty' &&
    scope.catalog_source.counterparty_id.length === 0;
  const pdIncomplete =
    scope.kind === 'phantom_demand_bom' &&
    (scope.sku.length === 0 || pdNeedsPartner);

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: nameError ? 'error' : 'active' },
    { id: 'scope', label: 'Scope', state: pdIncomplete ? 'error' : 'todo' },
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
    if (name.trim().length === 0) {
      setNameError(true);
      setError('Name is required.');
      jump('identity');
      return;
    }
    setNameError(false);
    if (pdIncomplete) {
      setError(
        pdNeedsPartner
          ? 'Select a trading partner for the counterparty catalog.'
          : 'Phantom demand requires a SKU.',
      );
      jump('scope');
      return;
    }
    setBusy(true);
    try {
      const body = {
        template_name: name,
        observation_class: OBSERVATION_CLASS,
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
      // v.1.45 — fire the first run, then land on the Phantom Demand queue
      // where it can be watched (queued → running → completed). A trigger
      // hiccup doesn't block navigation: the config exists and is runnable
      // from the queue.
      try {
        await fetch(`/api/account/sonar/templates/${newId}/trigger`, {
          method: 'POST',
        });
      } catch {
        /* ignore — the queue will show the config as "never run". */
      }
      router.push('/account/sonar/observations');
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
        </StepCard>

        <StepCard id="scope" index={1} title="Scope">
          <ScopePicker value={scope} onChange={setScope} />
        </StepCard>

        <StepCard id="lifecycle" index={2} title="Lifecycle">
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
