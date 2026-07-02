import type { WatcherSynthesisMode } from '@haiwave/protocol';

// The delivery signal payload is a SINGLE latest event, per the protocol
// DeliveryEventSchema (watcher/signal.ts) — not an events[] list. Direct events
// carry occurred_at + shipment_id + detail; the central aggregated variant
// carries timestamp + source_handle instead.
interface DirectDeliveryEvent {
  kind?: 'direct';
  event_type: string;
  occurred_at: string;
  shipment_id: string | null;
  detail: string | null;
}

interface AggregatedDeliveryEvent {
  kind: 'aggregated';
  event_type: string;
  timestamp: string;
  source_handle: string;
  details?: Record<string, unknown>;
}

type Payload = DirectDeliveryEvent | AggregatedDeliveryEvent;

interface Props {
  synthesisMode: WatcherSynthesisMode;
  payload: Payload | null;
}

export function DeliveryEventLog({ synthesisMode, payload }: Props) {
  if (synthesisMode === 'redacted_gap' || payload === null) {
    return <p className="text-sm italic text-slate">Order-status feed not shared.</p>;
  }

  const isAggregated = 'timestamp' in payload;
  const when = isAggregated ? payload.timestamp : payload.occurred_at;
  const shipmentId = isAggregated ? null : payload.shipment_id;
  const sourceHandle = isAggregated ? payload.source_handle : undefined;
  const detail = isAggregated ? null : payload.detail;

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-charcoal">{payload.event_type}</span>
        <span className="text-slate text-xs">{new Date(when).toLocaleString()}</span>
        {shipmentId && <span className="font-mono text-xs text-slate">{shipmentId}</span>}
        {sourceHandle && (
          <span className="font-mono text-xs text-slate">via {sourceHandle}</span>
        )}
        {detail && <span className="text-slate">{detail}</span>}
      </div>
    </div>
  );
}
