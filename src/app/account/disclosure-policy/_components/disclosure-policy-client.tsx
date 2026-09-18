'use client';

import { useState } from 'react';
import { DisclosurePolicyMatrix, type PolicyCell } from './disclosure-policy-matrix';
import { RoomParticipationPanel } from './room-participation-panel';
import { CounterpartyOverridesPanel, type OverrideWrite } from './counterparty-overrides-panel';
import type { AttributeClassSummary, DisclosurePolicyOverrideRow, DisclosurePolicyResponse, RoomParticipationState } from '@/lib/safe-room-types';

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

  /** The ONLY writer of the participant matrix: it always sends a whole cell (PF P5). */
  async function saveCell(cell: PolicyCell) {
    await fetch('/api/account/disclosure-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cell) });
    setMatrix((prev) => [...prev.filter((r) => !(r.attribute_class_id === cell.attribute_class_id && r.trust_class === cell.trust_class)), { ...cell, source: 'participant' }]);
  }

  /** The ONLY writer of an override: keyed (counterparty × class), never carrying a trust class (PF P6). */
  async function saveOverride(row: OverrideWrite) {
    if (!counterparty) return;
    await fetch(`/api/account/disclosure-policy/overrides/${encodeURIComponent(counterparty)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) });
    setOverrideRows((prev) => [...prev.filter((o) => o.attribute_class_id !== row.attribute_class_id), { counterparty_participant_id: counterparty, ...row }]);
  }

  async function toggleParticipation(attributeClassId: string | null, enabled: boolean) {
    await fetch('/api/account/room-participation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attribute_class_id: attributeClassId, enabled }) });
    setState((prev) => attributeClassId === null
      ? { ...prev, global: enabled }
      : { ...prev, per_class: { ...prev.per_class, [attributeClassId]: enabled } });
  }

  if (counterparty) {
    return (
      <>
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
      <DisclosurePolicyMatrix classes={classes} rows={matrix} onSave={saveCell} />
      <RoomParticipationPanel classes={classes} participation={state} onToggleParticipation={toggleParticipation} />
    </>
  );
}
