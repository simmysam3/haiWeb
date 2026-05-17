import type { PhantomDemandResult } from '@/lib/haiwave-api';
import { DataTable, type Column } from '@/components';
import { Pill, type PillProps } from '@/components/pill';

interface ProbeResultPayload {
  kind?: string;
  responder_quoted_quantity?: number | null;
  responder_completeness?: string | null;
  responder_confidence?: string | null;
  responder_response_time_ms?: number | null;
  responder_quoted_timeline?: string | null;
  free_text_response?: string | null;
}

const PROBE_TONE: Record<string, NonNullable<PillProps['tone']>> = {
  complete: 'success',
  partial: 'warn',
  declined: 'problem',
  gap: 'neutral',
  unknown: 'neutral',
};

function probeStatus(r: PhantomDemandResult): string {
  if (r.synthesis_mode === 'redacted_gap') return 'gap';
  const c = (r.payload as ProbeResultPayload).responder_completeness;
  return c ?? 'unknown';
}

const columns: Column<PhantomDemandResult>[] = [
  {
    key: 'sku',
    label: 'SKU',
    nowrap: true,
    render: (r) => (
      <span className="font-mono text-xs text-charcoal">{r.sku_id}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    nowrap: true,
    render: (r) => {
      const s = probeStatus(r);
      return <Pill category="probe_status" value={s} tone={PROBE_TONE[s]} />;
    },
  },
  {
    key: 'qty',
    label: 'Quoted Qty',
    align: 'right',
    nowrap: true,
    render: (r) => (r.payload as ProbeResultPayload).responder_quoted_quantity ?? '—',
  },
  {
    key: 'timeline',
    label: 'Timeline',
    nowrap: true,
    render: (r) => (
      <span className="text-xs">
        {(r.payload as ProbeResultPayload).responder_quoted_timeline ?? '—'}
      </span>
    ),
  },
  {
    key: 'confidence',
    label: 'Confidence',
    nowrap: true,
    render: (r) => (r.payload as ProbeResultPayload).responder_confidence ?? '—',
  },
  {
    key: 'latency',
    label: 'Latency (ms)',
    align: 'right',
    nowrap: true,
    render: (r) => (r.payload as ProbeResultPayload).responder_response_time_ms ?? '—',
  },
  {
    key: 'gap',
    label: 'Gap',
    render: (r) => (
      <span className="text-xs text-slate">
        {r.gap ? (r.gap as { reason?: string }).reason ?? '' : ''}
      </span>
    ),
  },
];

export function ProbeResultsTable({ results }: { results: PhantomDemandResult[] }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-charcoal mb-2">Probe Results</h2>
      <DataTable
        columns={columns}
        data={results}
        keyFn={(r) => r.sku_id}
        emptyMessage="No probe results yet."
      />
    </section>
  );
}
