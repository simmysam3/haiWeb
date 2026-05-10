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
      hop_budget: 5,
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
  const router = useRouter();

  function changeObservationClass(next: ObservationClass) {
    setObservationClass(next);
    // reset scope to a sane default for the new modality
    setScope(emptyScope(next));
  }

  async function submit() {
    setBusy(true);
    setError(null);
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
          setError(`Save failed (${res.status})`);
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
          setError(`Create failed (${res.status})`);
          return;
        }
        const payload = (await res.json()) as { template: RunTemplate };
        router.push(`/account/sonar/templates/${payload.template.template_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !initial) return;
    if (!confirm(`Delete template "${initial.template_name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/account/sonar/templates/${initial.template_id}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/account/sonar/templates');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Template name</span>
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

      {!isEdit && (
        <ScopePicker
          observationClass={observationClass}
          value={scope}
          onChange={setScope}
        />
      )}

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

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || name.length === 0}
          className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
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
