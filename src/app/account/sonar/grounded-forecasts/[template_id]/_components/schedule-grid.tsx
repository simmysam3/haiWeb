'use client';

import { useState } from 'react';
import type { ForecastClassBlock, GroundedForecastResult } from '@haiwave/protocol';
import { GroupedAccordion, AccordionGroupRow } from '@/components/grouped-accordion';
import { Pill } from '@/components/pill';
import { formatForecastMonth } from '../../_lib/render-commitment-schedule';

// v1.62 — the working drill-in under the commitment artifact: one accordion
// row per component class (pacers first, ranking order) carrying its lead
// evidence, expanding to the month rows with last-commit date, quantity, and
// the past-due flag. Renders from the same stored result document as the
// artifact — never a second data source.

interface Props {
  result: GroundedForecastResult;
}

// One-off pills for this surface use the explicit `definition` prop (the
// documented escape hatch in pill.tsx) rather than new PILL_DEFINITIONS
// categories — no other surface renders these values.
const CONFIDENCE_PILLS: Record<
  ForecastClassBlock['confidence'],
  { tone: 'success' | 'neutral' | 'warn'; label: string; definition: string }
> = {
  high: {
    tone: 'success',
    label: 'High confidence',
    definition:
      'At least 8 observed deliveries in a tight spread, with the current quote inside the observed range.',
  },
  med: {
    tone: 'neutral',
    label: 'Med confidence',
    definition: 'At least 3 observed deliveries; spread or quote agreement below the high bar.',
  },
  low: {
    tone: 'warn',
    label: 'Low confidence',
    definition:
      'Thin delivery history, a quote conflicting with the observed median, or no usable quote at all.',
  },
};

function basisLabel(basis: ForecastClassBlock['lead_basis']): string {
  switch (basis) {
    case 'max_of_both':
      return 'max(quoted, observed median)';
    case 'quoted':
      return 'quoted only';
    case 'observed':
      return 'observed only';
  }
}

function evidenceLine(block: ForecastClassBlock): string {
  const quoted = block.quoted_days !== null ? `quoted ${block.quoted_days} days` : 'no current quote';
  const { observed } = block;
  const observedPart =
    observed.sample_count > 0 &&
    observed.median_days !== null &&
    observed.min_days !== null &&
    observed.max_days !== null
      ? `observed median ${observed.median_days} (${observed.min_days}–${observed.max_days}, n=${observed.sample_count})`
      : 'no observed history';
  return `${quoted} · ${observedPart} · basis ${basisLabel(block.lead_basis)}`;
}

export function ScheduleGrid({ result }: Props) {
  // Caller-owned expansion state per the GroupedAccordion contract. Pacers
  // start open — they are the story; the rest is drill-in.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(result.classes.filter((c) => c.pacer).map((c) => c.product_class_id)),
  );

  function toggle(classId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }

  const rank = new Map(result.pacer_ranking.map((id, i) => [id, i] as const));
  const ordered = [...result.classes].sort(
    (a, b) =>
      (rank.get(a.product_class_id) ?? result.pacer_ranking.length) -
      (rank.get(b.product_class_id) ?? result.pacer_ranking.length),
  );

  return (
    <GroupedAccordion>
      {ordered.map((block) => {
        const confidence = CONFIDENCE_PILLS[block.confidence];
        const cells = result.schedule.filter(
          (s) => s.product_class_id === block.product_class_id,
        );
        return (
          <AccordionGroupRow
            key={block.product_class_id}
            groupKey={block.product_class_id}
            label={
              <span className="inline-flex items-baseline gap-2">
                <span>{block.product_class_id}</span>
                <span className="font-mono text-xs text-slate">{block.component_sku}</span>
              </span>
            }
            count={`lead ${block.lead_days} days`}
            extraSlot={
              <span className="inline-flex items-center gap-1.5">
                {block.pacer && (
                  <Pill
                    tone="info"
                    definition="This component class tops the critical path — its lead time paces the entire schedule."
                  >
                    Pacer
                  </Pill>
                )}
                <Pill tone={confidence.tone} definition={confidence.definition}>
                  {confidence.label}
                </Pill>
                {!block.quote_obtained && (
                  <Pill
                    tone="warn"
                    definition="No responder produced a usable quote — the lead time rests on observed delivery history alone."
                  >
                    No quote
                  </Pill>
                )}
              </span>
            }
            expanded={expanded.has(block.product_class_id)}
            onToggle={() => toggle(block.product_class_id)}
          >
            <div className="space-y-2 pr-3">
              <p className="text-xs text-slate">{evidenceLine(block)}</p>
              <table className="text-sm">
                <thead>
                  <tr>
                    {['Month', 'Commit by', 'Quantity', ''].map((h, i) => (
                      <th
                        key={h || `c${i}`}
                        className="pr-6 pb-1 text-left text-xs font-semibold uppercase tracking-wide text-slate"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => (
                    <tr key={cell.month}>
                      <td className="pr-6 py-0.5 text-charcoal">
                        {formatForecastMonth(cell.month)}
                      </td>
                      <td className="pr-6 py-0.5 font-mono text-xs text-charcoal">
                        {cell.last_commit_date}
                      </td>
                      <td className="pr-6 py-0.5 text-charcoal">
                        {cell.quantity.toLocaleString('en-US')}
                      </td>
                      <td className="py-0.5">
                        {cell.past_due && (
                          <Pill
                            tone="problem"
                            definition="The last commitment date for this month has already passed — the projection is at risk without expediting."
                          >
                            Past due
                          </Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionGroupRow>
        );
      })}
    </GroupedAccordion>
  );
}
