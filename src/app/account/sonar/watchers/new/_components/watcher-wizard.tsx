'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, WatcherScope } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { SchedulePicker } from '../../../_components/schedule-picker';
import { AuditLifecycleFields } from '../../../_components/audit-lifecycle-fields';
import { StepRail, type RailStep } from '../../../_components/step-rail';
import { StepCard } from '../../../_components/step-card';
import { NameField } from '../../../_components/name-field';
import { WatcherScopePicker } from './watcher-scope-picker';

/**
 * Four-step wizard for creating a new Watcher (v.1.43 Plan 2, Task 17).
 *
 * Mirrors <AuditWizard> structurally — Identity → Scope → Schedule → Lifecycle —
 * but defaults toward manual cadence + 30-day retention (watchers are tactical,
 * lower-ceremony observations than audits). On submit, POSTs to the watcher
 * definitions endpoint and, when the cadence is manual or Run-now is checked,
 * immediately dispatches a run via /api/account/sonar/watcher/runs.
 *
 * The submit-label logic intentionally diverges from audit's: there is no
 * fork-mode or run-again path here (no `source` prop) — the wizard always
 * creates a fresh watcher definition.
 */

const DEFAULT_RETENTION_DAYS = 30;

function defaultManualCadence(): Cadence {
  return { kind: 'manual_only' };
}

function emptyScope(): WatcherScope {
  return {
    kind: 'watcher',
    authorization_basis: 'bilateral',
    counterparties: [],
    // Lead time + capacity utilization band cover the two highest-signal
    // watcher use cases; delivery events are opt-in (noisier surface).
    signal_types: ['lead_time_distribution', 'capacity_utilization_band'],
    skus: [],
    depth_limit: 1,
  };
}

/**
 * Pure utility — compute the submit button label.
 *
 * Rules:
 *  - manual_only cadence       → 'Run now'
 *  - recurring + runNow on     → 'Schedule & run now'
 *  - recurring + runNow off    → 'Schedule'
 */
export function computeSubmitLabel(cadence: Cadence, runNow: boolean): string {
  if (cadence.kind === 'manual_only') return 'Run now';
  if (runNow) return 'Schedule & run now';
  return 'Schedule';
}

export function WatcherWizard() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<WatcherScope>(emptyScope);
  const [cadence, setCadence] = useState<Cadence>(defaultManualCadence);
  const [runNow, setRunNow] = useState(false);
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: 'active' },
    { id: 'scope', label: 'Watcher Scope', state: 'todo' },
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
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const tplRes = await fetch('/api/account/sonar/watcher/definitions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template_name: name,
          observation_class: 'watcher',
          scope,
          cadence,
          enabled: true,
          retention_days: retentionDays,
        }),
      });
      if (!tplRes.ok) {
        const info = await describeApiError(tplRes);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      const tplPayload = (await tplRes.json().catch(() => null)) as
        | { template?: { template_id?: string } }
        | null;
      const templateId = tplPayload?.template?.template_id;
      if (!templateId) {
        setError(
          'Watcher configuration was created but the server response was malformed. Refresh the list to confirm.',
        );
        return;
      }

      const shouldRunNow = cadence.kind === 'manual_only' || runNow;
      if (shouldRunNow) {
        const runRes = await fetch('/api/account/sonar/watcher/runs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            signal_types: scope.signal_types,
            counterparty_filter:
              scope.counterparties.length > 0 ? scope.counterparties : null,
            skus: scope.skus.length > 0 ? scope.skus : undefined,
            depth_limit: scope.depth_limit,
            template_id: templateId,
          }),
        });
        if (!runRes.ok) {
          const info = await describeApiError(runRes);
          setError(`Template created but the initial run failed: ${info.message}`);
          setSessionExpired(info.sessionExpired);
          router.push(`/account/sonar/watchers/definitions/${templateId}`);
          return;
        }
        const runPayload = (await runRes.json().catch(() => null)) as
          | { run_id?: string }
          | null;
        const runId = runPayload?.run_id;
        if (!runId) {
          setError(
            'Watcher run was triggered but the server response was malformed. Check the watcher history to confirm.',
          );
          return;
        }
        router.push(`/account/sonar/watchers/${runId}`);
        return;
      }

      router.push(`/account/sonar/watchers/definitions/${templateId}`);
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
      <div className="flex-1 max-w-2xl space-y-4">
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun="Watcher" value={name} onChange={setName} />
        </StepCard>

        <StepCard id="scope" index={1} title="Watcher Scope">
          <WatcherScopePicker value={scope} onChange={setScope} />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <SchedulePicker
            value={cadence}
            onChange={setCadence}
            runNow={runNow}
            onRunNowChange={setRunNow}
          />
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          <AuditLifecycleFields
            retentionDays={retentionDays}
            onRetentionChange={setRetentionDays}
          />
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="sticky bottom-0 mt-4 bg-navy text-white rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">
            {name.trim() ? 'Ready' : 'Name the watcher to continue'}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded bg-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-orange/90 disabled:opacity-60"
          >
            {busy ? 'Saving…' : computeSubmitLabel(cadence, runNow)}
          </button>
        </div>
      </div>
    </div>
  );
}
