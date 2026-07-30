'use client';

import { useState } from 'react';
import type { QueryGuardEvent, QueryGuardState } from '@haiwave/protocol';
import { Button, IdChip, Pill } from '@/components';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

/** Severity tone for each enforcement-state kind. Never orange. */
const KIND_TONE: Record<QueryGuardState['kind'], 'problem' | 'warn' | 'neutral'> = {
  block: 'problem',
  pause: 'warn',
  log: 'neutral',
};

interface Props {
  initialStates: QueryGuardState[];
}

const HEADERS = ['', 'Counterparty', 'State', 'Triggering rule', 'Since', 'Expires', ''] as const;

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

/**
 * Active enforcement states (pauses / blocks / elevated logging) against
 * counterparties, with Restore (block) and Clear (log) row actions. Pauses
 * have no action — haiCore's clear endpoint closes only log states, and a
 * pause lapses on its own `expires_at` (lazy expiry). Rows expand inline
 * (DetailChevron) to lazily fetch the state's triggering trip — resolved by
 * `triggering_event_id` against the counterparty's recent events — from the
 * events BFF route.
 *
 * Hand-rolled table (DataTable styling) because the shared DataTable cannot
 * render a colSpan inline-detail row.
 */
export function EnforcementStates({ initialStates }: Props) {
  const [states, setStates] = useState<QueryGuardState[]>(initialStates);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, QueryGuardEvent | null | 'loading'>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(state: QueryGuardState): Promise<void> {
    const next = new Set(expanded);
    if (next.has(state.id)) {
      next.delete(state.id);
      setExpanded(next);
      return;
    }
    next.add(state.id);
    setExpanded(next);
    if (details[state.id] === undefined) {
      // A state records the exact event that created it. Never substitute the
      // counterparty's newest event — later trips of other rules would
      // masquerade as this state's trigger.
      if (!state.triggering_event_id) {
        setDetails((d) => ({ ...d, [state.id]: null }));
        return;
      }
      setDetails((d) => ({ ...d, [state.id]: 'loading' }));
      try {
        // The events API has no by-id lookup; fetch the counterparty's recent
        // window and pick the triggering event out of it.
        const res = await fetch(
          `/api/account/query-guard/events?limit=100&counterparty=${encodeURIComponent(state.counterparty_participant_id)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const payload = (await res.json()) as { events?: QueryGuardEvent[] };
        const triggering =
          payload.events?.find((e) => e.id === state.triggering_event_id) ?? null;
        setDetails((d) => ({ ...d, [state.id]: triggering }));
      } catch {
        setDetails((d) => ({ ...d, [state.id]: null }));
      }
    }
  }

  async function act(state: QueryGuardState, verb: 'restore' | 'clear'): Promise<void> {
    setBusyId(state.id);
    setError(null);
    try {
      const res = await fetch(`/api/account/query-guard/states/${state.id}/${verb}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${verb === 'restore' ? 'Restore' : 'Clear'} failed (${res.status}): ${text}`);
      }
      setStates((rows) => rows.filter((r) => r.id !== state.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto rounded border border-slate/15">
        <table className="w-full text-sm">
          <thead className="bg-light-gray">
            <tr>
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  className="text-left text-xs font-medium uppercase tracking-wider text-slate py-2.5 px-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="py-8 px-4 text-center text-sm text-slate">
                  No counterparties are currently restricted.
                </td>
              </tr>
            ) : (
              states.map((state, i) => {
                const isOpen = expanded.has(state.id);
                const detail = details[state.id];
                const triggeringEvent = detail !== 'loading' ? detail : undefined;
                return (
                  <StateRow
                    key={state.id}
                    state={state}
                    first={i === 0}
                    isOpen={isOpen}
                    detail={detail}
                    triggeringEvent={triggeringEvent ?? null}
                    busy={busyId === state.id}
                    onToggle={() => toggle(state)}
                    onAct={(verb) => act(state, verb)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="mt-3 text-sm text-problem" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StateRow({
  state,
  first,
  isOpen,
  detail,
  triggeringEvent,
  busy,
  onToggle,
  onAct,
}: {
  state: QueryGuardState;
  first: boolean;
  isOpen: boolean;
  detail: QueryGuardEvent | null | 'loading' | undefined;
  triggeringEvent: QueryGuardEvent | null;
  busy: boolean;
  onToggle: () => void;
  onAct: (verb: 'restore' | 'clear') => void;
}) {
  return (
    <>
      <tr className={`${first ? '' : 'border-t border-slate/10'} hover:bg-light-gray/50`}>
        <td className="py-2.5 px-4">
          <button
            type="button"
            aria-label={`Show triggering trip for ${state.counterparty_participant_id}`}
            aria-expanded={isOpen}
            onClick={onToggle}
            className="group inline-flex"
          >
            <DetailChevron expanded={isOpen} />
          </button>
        </td>
        <td className="py-2.5 px-4">
          <IdChip id={state.counterparty_participant_id} />
        </td>
        <td className="py-2.5 px-4">
          <Pill category="query_guard_state" value={state.kind} tone={KIND_TONE[state.kind]} />
        </td>
        <td className="py-2.5 px-4">
          {triggeringEvent ? (
            <Pill category="query_guard_rule" value={triggeringEvent.rule_type} />
          ) : (
            <span className="text-slate">&mdash;</span>
          )}
        </td>
        <td className="py-2.5 px-4 whitespace-nowrap">{formatWhen(state.created_at)}</td>
        <td className="py-2.5 px-4 whitespace-nowrap">{formatWhen(state.expires_at)}</td>
        <td className="py-2.5 px-4 text-right">
          {state.kind === 'block' && (
            <Button variant="secondary" disabled={busy} onClick={() => onAct('restore')}>
              Restore
            </Button>
          )}
          {state.kind === 'log' && (
            <Button variant="secondary" disabled={busy} onClick={() => onAct('clear')}>
              Clear
            </Button>
          )}
          {/* pause: no action — haiCore cannot clear a pause; it lapses at expires_at */}
          {state.kind === 'pause' && <span className="text-slate">&mdash;</span>}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-slate/10 bg-light-gray/40">
          <td colSpan={7} className="py-2.5 px-4 text-sm text-charcoal">
            {detail === 'loading' && <span className="text-slate">Loading triggering trip&hellip;</span>}
            {detail === null && (
              <span className="text-slate">No trip recorded for this counterparty.</span>
            )}
            {detail !== 'loading' && detail != null && (
              <span>
                Tripped <span className="font-medium">{detail.rule_type}</span>: {detail.observed_value}{' '}
                &gt; {detail.threshold_value}
                {detail.window ? ` / ${detail.window}` : '%'} ({detail.origin}, {detail.modality}) on{' '}
                {formatWhen(detail.created_at)}. Actions:{' '}
                {detail.actions_taken.map((a) => a.type).join(', ') || 'none'}.
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
