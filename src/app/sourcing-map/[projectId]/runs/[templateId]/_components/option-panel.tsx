'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SmOptionPanel } from '@/lib/sourcing-map/types';
import { smFetch } from '@/lib/sourcing-map/client';
import { DIMENSION_LABEL, leadTimeText } from '@/lib/sourcing-map/backlogs';
import { EM_DASH, formatDay, formatPct } from '@/lib/sourcing-map/map/selectors';

type PanelState = { kind: 'loading' } | { kind: 'ok'; panel: SmOptionPanel } | { kind: 'failed' };

const PANEL_START = 'sm-panel-open-start';
const PANEL_MEASURE = 'sm-panel-open';
const SCORECARD_HEADING = 'Network-wide scorecard (not specific to you)';
const EVENTS_SHOWN = 10;

/**
 * The option panel (spec §12.3): the network scorecard and the delivery history, each section settling on its own.
 * The panel never blanks: a failed read, or an unserved part, reads "Unavailable" under its own heading.
 */
export function OptionPanel({ executionId, candidateKey }: { executionId: string; candidateKey: string | null }) {
  // The answer carries the request it belongs to, so a key change reads `loading` at once and a late answer never shows.
  const [answer, setAnswer] = useState<{ request: string; panel: SmOptionPanel | null } | null>(null);
  const request = `${executionId}/${candidateKey}`;
  const state: PanelState = candidateKey === null ? { kind: 'failed' }
    : answer?.request !== request ? { kind: 'loading' }
    : answer.panel === null ? { kind: 'failed' } : { kind: 'ok', panel: answer.panel };
  // R-9: mark on mount, measure the first time the state leaves `loading` (never before it settles, never twice).
  const measured = useRef(false);
  useLayoutEffect(() => {
    performance.clearMarks(PANEL_START);
    performance.mark(PANEL_START);
  }, []);
  useLayoutEffect(() => {
    if (state.kind === 'loading' || measured.current) return;
    measured.current = true;
    performance.clearMeasures(PANEL_MEASURE);
    performance.measure(PANEL_MEASURE, PANEL_START);
  }, [state.kind]);
  useEffect(() => {
    if (candidateKey === null) return;
    let live = true;
    void smFetch<SmOptionPanel>(`/api/account/sourcing-map/executions/${executionId}/options/${encodeURIComponent(candidateKey)}/panel`).then((r) => {
      if (live) setAnswer({ request, panel: r.ok ? r.data : null });
    });
    return () => {
      live = false;
    };
  }, [executionId, candidateKey, request]);

  const panel = state.kind === 'ok' ? state.panel : null;
  const unavailable = (part: 'scorecard' | 'delivery_history') => panel === null || panel.unavailable.includes(part);
  const scorecard = panel?.scorecard ?? null;
  const history = panel?.delivery_history ?? null;
  const leadTime = history ? leadTimeText(history.lead_time) : null;
  return (
    <>
      <section aria-label={SCORECARD_HEADING} className="mt-6">
        <h3 className="sm-muted text-xs">{SCORECARD_HEADING}</h3>
        {state.kind === 'loading' ? (
          <p className="sm-muted mt-1">Loading…</p>
        ) : unavailable('scorecard') || scorecard === null ? (
          <p className="sm-muted mt-1">Unavailable</p>
        ) : (
          <ul aria-label="Scorecard dimensions" className="mt-1">
            {scorecard.dimensions.map((d) => (
              <li key={d.key}>
                {DIMENSION_LABEL[d.key]}
                {' · '}
                {formatPct(d.value)}
                {d.provisional && <>{' · '}<span className="sm-muted">provisional</span></>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {(state.kind === 'loading' || unavailable('delivery_history') || history !== null) && (
        <section aria-label="Delivery history" className="mt-6">
          <h3 className="sm-muted text-xs">Delivery history</h3>
          {state.kind === 'loading' ? (
            <p className="sm-muted mt-1">Loading…</p>
          ) : history === null ? (
            <p className="sm-muted mt-1">Unavailable</p>
          ) : (
            <>
              {leadTime !== null && <p className="mt-1">{leadTime}</p>}
              <ul className="mt-1">
                {history.events.slice(0, EVENTS_SHOWN).map((e, i) => (
                  <li key={i}>{`${e.event_type.replace(/_/g, ' ')} · ${formatDay(e.occurred_at)} · ${e.shipment_id ?? EM_DASH}`}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
