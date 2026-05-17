import type { PhantomDemandResult } from '@/lib/haiwave-api';
import { DataTable, type Column } from '@/components';
import { Pill } from '@/components/pill';
import {
  interpretProbeResult,
  type ProbeAsk,
  type InterpretedProbeResult,
} from '@/app/account/sonar/phantom-demand/_lib/interpret-probe-result';

function ResultCell({ r, ask }: { r: PhantomDemandResult; ask: ProbeAsk }) {
  const i: InterpretedProbeResult = interpretProbeResult(r, ask);

  const facts: string[] = [];
  if (i.quotedQuantity != null) {
    facts.push(
      i.verdict === 'partial'
        ? `${i.quotedQuantity} of ${ask.hypothetical_quantity}`
        : `${i.quotedQuantity}`,
    );
  }
  if (i.quotedTimeline) {
    const d = new Date(i.quotedTimeline);
    if (!Number.isNaN(d.getTime())) facts.push(`by ${d.toLocaleDateString()}`);
  }
  const noData = i.verdict === 'no_answer' || i.verdict === 'unusable';

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <Pill category="probe_verdict" value={i.verdict} tone={i.tone}>
          {i.verdictLabel}
        </Pill>
        {facts.length > 0 && (
          <span className="text-xs text-charcoal">· {facts.join(' · ')}</span>
        )}
        {noData && <span className="text-xs text-slate">— availability unknown</span>}
        <span className="text-xs text-slate">
          ·{' '}
          {i.confidence ? (
            `confidence ${i.confidence}`
          ) : (
            <span className="italic text-slate/70">confidence n/a</span>
          )}
        </span>
      </div>
      <div className="mt-1 flex items-start gap-1.5 text-xs text-charcoal/80">
        <span
          aria-hidden
          className="mt-[1px] inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal text-[9px] leading-none text-white"
        >
          i
        </span>
        <span>{i.action}</span>
      </div>
    </div>
  );
}

const makeColumns = (ask: ProbeAsk): Column<PhantomDemandResult>[] => [
  {
    key: 'sku',
    label: 'SKU',
    nowrap: true,
    render: (r) => <span className="font-mono text-xs text-charcoal">{r.sku_id}</span>,
  },
  {
    key: 'result',
    label: 'Result',
    render: (r) => <ResultCell r={r} ask={ask} />,
  },
];

export function ProbeResultsTable({
  results,
  ask,
}: {
  results: PhantomDemandResult[];
  ask: ProbeAsk;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-charcoal mb-2">Probe Results</h2>
      <DataTable
        columns={makeColumns(ask)}
        data={results}
        keyFn={(r) => r.sku_id}
        emptyMessage="No probe results yet."
      />
    </section>
  );
}
