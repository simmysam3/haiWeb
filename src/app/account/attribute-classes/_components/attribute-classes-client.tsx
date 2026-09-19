'use client';

import { useState } from 'react';
import type { AttributeClassProposal } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { ProposeForm } from './propose-form';
import type { AttributeClassProposalRow, AttributeClassSummary } from '@/lib/safe-room-types';

export function AttributeClassesClient({ classes, initialProposals }: { classes: AttributeClassSummary[]; initialProposals: AttributeClassProposalRow[] }) {
  const [proposals, setProposals] = useState(initialProposals);
  const [error, setError] = useState<string | null>(null);

  /**
   * Final fix wave item 1: a rejected proposal must not fail silently. Mirrors the full
   * `putOrFail` shape (disclosure-policy-client.tsx, at the tip after items 12/13/22) — the
   * fetch is wrapped so a thrown fetch shows the same alert (item 12's class), the failure branch
   * reuses `describeApiError` so the alert shows haiCore's parsed `error.message` rather than the
   * raw envelope (item 22's class), and `res.json()` is guarded with `setError(null)` only after a
   * successful parse that actually carries a `proposal` (the addendum's class: a malformed or
   * proposal-less 2xx must not store `undefined` into the list, which the render at
   * `p.proposed_shape.display_name` below would then throw on).
   */
  async function submit(value: AttributeClassProposal) {
    let res: Response;
    try {
      res = await fetch('/api/account/attribute-classes/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    } catch {
      setError('Could not reach the server. Please try again.');
      return;
    }
    if (!res.ok) {
      const info = await describeApiError(res);
      setError(`Save failed (${info.status}): ${info.message}`);
      return;
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      setError('Could not read the server response. Please try again.');
      return;
    }
    const proposal = (body as { proposal?: AttributeClassProposalRow } | null)?.proposal;
    if (!proposal) {
      setError('Save failed: the server did not return the new proposal.');
      return;
    }
    setError(null);
    setProposals((prev) => [proposal, ...prev]);
  }

  return (
    <>
      {error && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error}</div>}
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Adopted classes</h2><ul className="space-y-1 text-sm text-charcoal">{classes.map((c) => <li key={c.attribute_class_id}>{c.display_name}</li>)}</ul></section>
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Propose a new class</h2><ProposeForm onSubmit={submit} /></section>
      {/* PF P9: the row's id is `id`, and its display name lives inside proposed_shape. */}
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Your proposals</h2><ul className="space-y-1 text-sm text-charcoal">{proposals.map((p) => <li key={p.id}>{p.proposed_shape.display_name} — {p.status}</li>)}</ul></section>
    </>
  );
}
