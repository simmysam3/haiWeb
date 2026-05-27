'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ComplianceChange, ComplianceChangeOutcome } from '@haiwave/protocol';

const OUTCOME_OPTIONS: ReadonlyArray<{ value: ComplianceChangeOutcome; label: string }> = [
  { value: 'tier1_acceptable',        label: 'Tier 1 follow up resulted in acceptable change' },
  { value: 'tier2_adverse',           label: 'Tier 2 follow up resulted in adverse outcome' },
  { value: 'replacement_supplier',    label: 'Replacement Supplier Identified' },
  { value: 'exemption_temporary_90d', label: 'Temporary exemption for 90 days' },
  { value: 'exemption_permanent',     label: 'Permanent Exemption — no alternatives available' },
  { value: 'other',                   label: 'Other Outcome' },
];

interface Props {
  change: ComplianceChange;
}

export function OutcomeForm({ change }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ComplianceChangeOutcome | ''>(
    change.processed_outcome ?? '',
  );
  const [description, setDescription] = useState<string>(
    change.processed_outcome_description ?? '',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessed = change.processed_at != null;
  const submitLabel = isProcessed ? 'Update outcome' : 'Process';
  const requiresDescription = outcome === 'other';
  const canSubmit =
    outcome !== '' &&
    !(requiresDescription && description.trim().length === 0) &&
    !pending;

  async function onSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const trimmed = description.trim();
      const body = {
        outcome,
        description:
          outcome === 'other' ? trimmed : (trimmed.length > 0 ? trimmed : null),
      };
      const res = await fetch(
        `/api/account/sonar/compliance/changes/${encodeURIComponent(change.change_id)}/process`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const parsed = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(parsed?.error?.message ?? 'Process failed.');
        setPending(false);
        return;
      }
      router.push('/account/sonar/audit/events');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Process failed.');
      setPending(false);
    }
  }

  return (
    <section
      data-testid="outcome-form"
      className="mt-6 rounded-lg border border-slate/20 bg-white p-6"
    >
      <h2 className="text-base font-semibold text-navy">Outcome</h2>
      <p className="mt-2 text-sm text-slate">
        Record what you did about this event. Choosing an outcome marks the row processed and removes it from the default inbox.
      </p>

      {error ? (
        <div role="alert" className="mt-4 rounded-md border border-red-900/30 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-navy">Outcome</span>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ComplianceChangeOutcome | '')}
            aria-label="Outcome"
            className="rounded-md border border-slate/30 px-2 py-1.5 text-sm"
          >
            <option value="">Select outcome…</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {requiresDescription ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-navy">Description or Reason</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              aria-label="Description or Reason"
              className="rounded-md border border-slate/30 px-2 py-1.5 text-sm"
            />
          </label>
        ) : null}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-md border border-teal bg-teal px-4 py-1.5 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
          >
            {pending ? 'Saving…' : submitLabel}
          </button>
          <Link
            href="/account/sonar/audit/events"
            className="rounded-md border border-slate/30 px-4 py-1.5 text-sm text-slate hover:border-teal hover:text-navy"
          >
            Return to events
          </Link>
        </div>
      </div>
    </section>
  );
}
