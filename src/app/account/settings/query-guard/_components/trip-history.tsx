'use client';

import { useMemo, useState } from 'react';
import type { QueryGuardEvent, QueryGuardRuleType } from '@haiwave/protocol';
import { DataTable, IdChip, Pill, type Column } from '@/components';
import { RULE_TYPES } from './guard-rules-matrix';

interface Props {
  initialEvents: QueryGuardEvent[];
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** "12 > 10 / day" for windowed rules; "150 > 100%" for excess_volume. */
function formatObserved(ev: QueryGuardEvent): string {
  if (ev.window) return `${ev.observed_value} > ${ev.threshold_value} / ${ev.window}`;
  return `${ev.observed_value} > ${ev.threshold_value}%`;
}

/**
 * Trip history for the caller's query-guard rules — one row per recorded
 * guard event, with client-side counterparty + rule-type filters over the
 * server-fetched window.
 */
export function TripHistory({ initialEvents }: Props) {
  const [counterparty, setCounterparty] = useState<string>('all');
  const [ruleType, setRuleType] = useState<string>('all');

  const counterparties = useMemo(
    () => [...new Set(initialEvents.map((e) => e.counterparty_participant_id))],
    [initialEvents],
  );

  const filtered = initialEvents.filter(
    (e) =>
      (counterparty === 'all' || e.counterparty_participant_id === counterparty) &&
      (ruleType === 'all' || e.rule_type === ruleType),
  );

  const columns: Column<QueryGuardEvent>[] = [
    {
      key: 'when',
      label: 'When',
      nowrap: true,
      render: (ev) => formatWhen(ev.created_at),
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      render: (ev) => <IdChip id={ev.counterparty_participant_id} />,
    },
    {
      key: 'rule',
      label: 'Rule',
      render: (ev) => <Pill category="query_guard_rule" value={ev.rule_type} />,
    },
    {
      key: 'observed',
      label: 'Observed vs threshold',
      nowrap: true,
      render: (ev) => formatObserved(ev),
    },
    {
      key: 'origin',
      label: 'Origin',
      render: (ev) => ev.origin,
    },
    {
      key: 'actions',
      label: 'Actions taken',
      render: (ev) => (
        <span className="inline-flex items-center gap-2">
          {ev.actions_taken.map((a) => a.type).join(', ') || '—'}
          {ev.alert_suppressed && (
            <Pill
              tone="neutral"
              definition="The alert action fired earlier for this counterparty and rule; this repeat trip did not send another email."
            >
              alert muted
            </Pill>
          )}
        </span>
      ),
    },
  ];

  const selectClass =
    'rounded border border-slate/20 bg-white px-2 py-1.5 text-sm text-charcoal';

  return (
    <DataTable
      columns={columns}
      data={filtered}
      keyFn={(ev) => ev.id}
      emptyMessage="No guard trips recorded."
      toolbar={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate">
            Counterparty
            <select
              className={selectClass}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            >
              <option value="all">All</option>
              {counterparties.map((cp) => (
                <option key={cp} value={cp}>
                  {cp}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate">
            Rule type
            <select
              className={selectClass}
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
            >
              <option value="all">All</option>
              {RULE_TYPES.map((rt: QueryGuardRuleType) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    />
  );
}
