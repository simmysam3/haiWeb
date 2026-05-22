'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplate } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { configNoun } from '../_lib/config-noun';
import { CadencePicker } from '../../_components/cadence-picker';
import { StepRail, type RailStep } from '../../_components/step-rail';
import { StepCard } from '../../_components/step-card';
import { ScopeSummary } from './scope-summary';
import { NameField } from '../../_components/name-field';
import { LifecycleFields } from '../../_components/lifecycle-fields';

const steps: RailStep[] = [
  { id: 'identity', label: 'Identity', state: 'active' },
  { id: 'scope', label: 'Scope', state: 'locked' },
  { id: 'schedule', label: 'Schedule', state: 'todo' },
  { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
  { id: 'history', label: 'Run history', state: 'todo' },
];

export function TemplateEditor({ template }: { template: RunTemplate }) {
  const noun = configNoun(template.observation_class);
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
      const res = await fetch(`/api/account/sonar/templates/${template.template_id}`, {
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

  async function remove() {
    if (
      !confirm(
        `Delete ${noun.toLowerCase()} "${template.template_name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/sonar/templates/${template.template_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.push('/account/sonar/templates');
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
          <div className="mt-3 text-sm text-charcoal">
            <span className="text-[11px] uppercase tracking-wide text-slate mr-2">
              Modality
            </span>
            <span className="font-medium">{noun}</span>
          </div>
        </StepCard>

        <StepCard id="scope" index={1} title="Scope" locked>
          <ScopeSummary scope={template.scope} />
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
