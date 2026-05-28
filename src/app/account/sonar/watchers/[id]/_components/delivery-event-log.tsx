'use client';

import { useState } from 'react';
import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface DeliveryEvent {
  event_type: 'dispatched' | 'in_transit' | 'delayed' | 'delivered' | 'exception';
  occurred_at: string;
  shipment_id: string | null;
  detail: string | null;
  source_handle?: string;
}

interface Payload {
  events: DeliveryEvent[];
}

interface Props {
  synthesisMode: WatcherSynthesisMode;
  payload: Payload | null;
}

const INITIAL_VISIBLE = 3;

export function DeliveryEventLog({ synthesisMode, payload }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (synthesisMode === 'redacted_gap' || payload === null) {
    return <p className="text-sm italic text-slate">Order-status feed not shared.</p>;
  }

  const events = [...payload.events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const visible = expanded ? events : events.slice(0, INITIAL_VISIBLE);
  const hidden = Math.max(0, events.length - INITIAL_VISIBLE);

  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        {visible.map((e, i) => (
          <li
            key={`${e.shipment_id ?? 'no-shipment'}-${e.occurred_at}-${i}`}
            className="flex flex-wrap items-baseline gap-2"
          >
            <span className="font-medium text-charcoal">{e.event_type}</span>
            <span className="text-slate text-xs">
              {new Date(e.occurred_at).toLocaleString()}
            </span>
            {e.shipment_id && (
              <span className="font-mono text-xs text-slate">{e.shipment_id}</span>
            )}
            {e.source_handle && (
              <span className="font-mono text-xs text-slate">
                via {e.source_handle}
              </span>
            )}
            {e.detail && <span className="text-slate">{e.detail}</span>}
          </li>
        ))}
      </ul>
      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-teal hover:underline"
        >
          Show {hidden} more event{hidden === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
