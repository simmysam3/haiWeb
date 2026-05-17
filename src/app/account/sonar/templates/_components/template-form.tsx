'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Cadence,
  CreateRunTemplateRequest,
  RunTemplate,
  RunTemplateScope,
} from '@haiwave/protocol';
import { CadencePicker } from './cadence-picker';
import { ScopePicker } from './scope-picker';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../_lib/system-config';
import { configNoun } from '../_lib/config-noun';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';

type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

interface TemplateFormProps {
  /** If provided, the form runs in edit mode (PATCH instead of POST). */
  initial?: RunTemplate;
  /** Pre-fills observation_class on a fresh form (used by Save-as-template CTAs). */
  defaultObservationClass?: ObservationClass;
}

function emptyScope(observationClass: ObservationClass): RunTemplateScope {
  if (observationClass === 'audit') {
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
  if (observationClass === 'watcher') {
    return {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['lead_time_distribution'],
      depth_limit: 1,
    };
  }
  // phantom_demand
  return {
    kind: 'phantom_demand',
    authorization_basis: 'bilateral',
    counterparty: '',
    skus: [],
    hypothetical_quantity: 1,
    hypothetical_timeline: null,
  };
}

export function TemplateForm({ initial, defaultObservationClass }: TemplateFormProps) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.template_name ?? '');
  const [observationClass, setObservationClass] = useState<ObservationClass>(
    initial?.observation_class ?? defaultObservationClass ?? 'audit',
  );
  // Per-modality user-facing noun (this form is always single-modality).
  const noun = configNoun(observationClass);
  const [cadence, setCadence] = useState<Cadence>(
    initial?.cadence ?? { kind: 'manual_only' },
  );
  const [scope, setScope] = useState<RunTemplateScope>(
    initial?.scope ?? emptyScope(observationClass),
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [retentionDays, setRetentionDays] = useState(initial?.retention_days ?? 365);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  async function surfaceFailure(res: Response): Promise<void> {
    const info = await describeApiError(res);
    setError(info.message);
    setSessionExpired(info.sessionExpired);
  }

  function changeObservationClass(next: ObservationClass) {
    setObservationClass(next);
    // reset scope to a sane default for the new modality
    setScope(emptyScope(next));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      if (isEdit && initial) {
        const body = {
          template_name: name,
          cadence,
          enabled,
          retention_days: retentionDays,
        };
        const res = await fetch(
          `/api/account/sonar/templates/${initial.template_id}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          await surfaceFailure(res);
          return;
        }
        router.refresh();
      } else {
        // observationClass and scope are kept in sync by changeObservationClass;
        // TypeScript can't prove the discriminated-union invariant across two
        // independent state variables, so we assert here.
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
          await surfaceFailure(res);
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
      }
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial) return;
    if (
      !confirm(
        `Delete ${noun.toLowerCase()} "${initial.template_name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(
        `/api/account/sonar/templates/${initial.template_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        await surfaceFailure(res);
        return;
      }
      router.push('/account/sonar/templates');
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Edit mode never gates on scope (scope is read-only on PATCH).
  const pdIncomplete =
    !isEdit &&
    observationClass === 'phantom_demand' &&
    scope.kind === 'phantom_demand' &&
    (scope.counterparty.length === 0 || scope.skus.length === 0);

  return (
    <div className="space-y-6">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">{noun} name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-full max-w-md"
          required
        />
      </label>

      {!isEdit && (
        <label className="block text-sm text-charcoal">
          <span className="block mb-1 font-medium" id="modality-label">Modality</span>
          <select
            aria-labelledby="modality-label"
            aria-label="Modality"
            value={observationClass}
            onChange={(e) => changeObservationClass(e.target.value as ObservationClass)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="audit">Audit</option>
            <option value="watcher">Watcher</option>
            <option value="phantom_demand">Phantom Demand</option>
          </select>
        </label>
      )}

      <CadencePicker value={cadence} onChange={setCadence} />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <span>Retention (days)</span>
          <input
            type="number"
            value={retentionDays}
            min={30}
            max={365}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setRetentionDays(n);
            }}
            className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
          />
        </label>
      </div>

      {!isEdit && (
        <ScopePicker
          observationClass={observationClass}
          value={scope}
          onChange={setScope}
        />
      )}

      {error && <FormError message={error} sessionExpired={sessionExpired} />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || name.length === 0 || pdIncomplete}
          className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : `Create ${noun.toLowerCase()}`}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded border border-rose-400 text-rose-700 px-3 py-1.5 text-sm hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
