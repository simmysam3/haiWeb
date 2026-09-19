'use client';

import { useState } from 'react';
import { describeApiError } from '@/lib/api-error';
import { DisclosurePolicyMatrix, type PolicyCell } from './disclosure-policy-matrix';
import { RoomParticipationPanel } from './room-participation-panel';
import { CounterpartyOverridesPanel, type OverrideWrite } from './counterparty-overrides-panel';
import type { AttributeClassSummary, DisclosurePolicyOverrideRow, DisclosurePolicyResponse, DisclosurePolicyRow, RoomParticipationState } from '@/lib/safe-room-types';

interface Props {
  classes: AttributeClassSummary[];
  policy: DisclosurePolicyResponse;
  participation: RoomParticipationState;
  overrides: DisclosurePolicyOverrideRow[];
  counterparty: string | null;
}

export function DisclosurePolicyClient({ classes, policy, participation, overrides, counterparty }: Props) {
  const [matrix, setMatrix] = useState(policy.matrix);
  const [state, setState] = useState(participation);
  const [overrideRows, setOverrideRows] = useState(overrides);
  const [error, setError] = useState<string | null>(null);

  /**
   * I1 fix (review-L7-1): a rejected save must not be displayed as applied policy. Every writer
   * checks res.ok before touching local state, following the GuardRulesMatrix.save() precedent
   * (guard-rules-matrix.tsx:160) — on failure the prior state is kept and the page's existing
   * inline-alert convention (page.tsx:28 — role="alert", text-problem) is shown here too.
   *
   * Item 12 (final fix wave): a thrown fetch (offline, DNS) must show the same alert, not escape
   * as an unhandled rejection — mirrors the confirmed() precedent (partners-panel.tsx).
   *
   * Item 13 (final fix wave): returns the parsed response body (haiCore's stored `{ row }`,
   * disclosure-policy.ts:110/:134) rather than a bare boolean, so callers apply what the server
   * actually stored instead of assuming it stored exactly what was requested.
   *
   * Item 22 (final fix wave): the failure branch used to interpolate haiCore's raw error envelope
   * ({ error: { code, message, timestamp, request_id, details? } }, lib/reply.ts:23-31) straight
   * into the alert. `describeApiError` (the partners-panel.tsx confirmed() precedent) already
   * parses this exact envelope and falls back gracefully on a non-JSON body.
   */
  async function putOrFail(url: string, body: unknown): Promise<unknown | null> {
    let res: Response;
    try {
      res = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      setError('Could not reach the server. Please try again.');
      return null;
    }
    if (!res.ok) {
      const info = await describeApiError(res);
      setError(`Save failed (${info.status}): ${info.message}`);
      return null;
    }
    // A malformed 2xx body must not escape either — the same failure mode item 12 closed for the
    // fetch call itself, reopened by item 13 adding this parse.
    try {
      const parsed = await res.json();
      setError(null);
      return parsed;
    } catch {
      setError('Could not read the server response. Please try again.');
      return null;
    }
  }

  /** The ONLY writer of the participant matrix: it always sends a whole cell (PF P5). */
  async function saveCell(cell: PolicyCell) {
    const result = await putOrFail('/api/account/disclosure-policy', cell);
    if (!result) return;
    const { row } = result as { row: DisclosurePolicyRow };
    setMatrix((prev) => [...prev.filter((r) => !(r.attribute_class_id === row.attribute_class_id && r.trust_class === row.trust_class)), row]);
  }

  /** The ONLY writer of an override: keyed (counterparty × class), never carrying a trust class (PF P6). */
  async function saveOverride(row: OverrideWrite) {
    if (!counterparty) return;
    const result = await putOrFail(`/api/account/disclosure-policy/overrides/${encodeURIComponent(counterparty)}`, row);
    if (!result) return;
    const { row: savedRow } = result as { row: DisclosurePolicyOverrideRow };
    setOverrideRows((prev) => [...prev.filter((o) => o.attribute_class_id !== savedRow.attribute_class_id), savedRow]);
  }

  async function toggleParticipation(attributeClassId: string | null, enabled: boolean) {
    if (!(await putOrFail('/api/account/room-participation', { attribute_class_id: attributeClassId, enabled }))) return;
    setState((prev) => attributeClassId === null
      ? { ...prev, global: enabled }
      : { ...prev, per_class: { ...prev.per_class, [attributeClassId]: enabled } });
  }

  const alert = error && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error}</div>;

  if (counterparty) {
    return (
      <>
        {alert}
        <section aria-labelledby="override-heading" className="mb-6 space-y-2">
          <h2 id="override-heading" className="text-lg font-semibold text-charcoal">Override for counterparty {counterparty}</h2>
          <p className="text-xs text-slate">These overrides apply to this counterparty only, above your participant defaults, and are not per trust class. An override can be added or changed here; removing one is not yet supported.</p>
        </section>
        <CounterpartyOverridesPanel classes={classes} overrides={overrideRows} onSaveOverride={saveOverride} />
      </>
    );
  }

  return (
    <>
      {alert}
      <DisclosurePolicyMatrix classes={classes} rows={matrix} onSave={saveCell} />
      <RoomParticipationPanel classes={classes} participation={state} onToggleParticipation={toggleParticipation} />
    </>
  );
}
