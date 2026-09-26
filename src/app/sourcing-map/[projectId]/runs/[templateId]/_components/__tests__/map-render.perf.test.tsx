import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { vomeroResult, weeklyDropsResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SourcingMapExecutionResult } from '@haiwave/protocol';
import { MapCanvas } from '../map-canvas';

/**
 * R-9 one-off (Task 40, ruling 10): runs only with SM_PERF=1, and every gate skips it.
 * For information: Node's perf_hooks, render + commit, no layout or paint. The verdict is the walk's browser number.
 */
const SEAT = { name: 'CSG Footwear Vietnam', country: 'VN', classLabel: 'Athletic footwear', productCount: 25, slotCount: 100, assemblyDays: '21', capacity: null };

/** R-9 worst case: 100 slots × 6 answered cards × 52 weekly drops. */
function sp1Max(): SourcingMapExecutionResult {
  const base = weeklyDropsResult(52);
  const weeks = base.portfolio.drops.map((d) => d.due_date);
  const template = base.slots[0]!;
  const slots = Array.from({ length: 100 }, (_, s) => ({
    ...template,
    slot_key: { ...template.slot_key, class_id: `cpt_synthetic_${s}`, variant_bound: false, variant_system: null },
    class_label: `Synthetic class ${s}`,
    demand: weeks.map((w, i) => ({ week: w, cum_qty: 1000 * (i + 1), cum_qty_by_variant: null })),
    coverage: weeks.map((w, i) => ({ week: w, covered: 900 * (i + 1), coverage: 0.9, covered_by_variant: null, coverage_by_variant: null })),
    as_of_weeks: weeks.map((w) => ({ drop: w, week: w })),
    not_probed_count: 0,
    candidates: Array.from({ length: 6 }, (_, c) => ({
      ...template.candidates[1]!,
      supplier_name: `Supplier ${s}-${c}`,
      weeks: weeks.map((w, i) => ({ week: w, cum_achievable: (700 + 50 * c) * (i + 1), cum_achievable_by_variant: null, option_coverage: Math.min(1, (700 + 50 * c) / 1000) })),
    })),
  }));
  return { ...base, slots };
}

function medianRender(result: SourcingMapExecutionResult, asOf: string | null): number {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const { unmount } = render(
      <MapCanvas result={result} asOfDrop={asOf} productFilter={null} productNames={{}} seat={SEAT} selected={null} onSelect={vi.fn()} collapsed={new Set()} onToggle={vi.fn()} />,
    );
    samples.push(performance.getEntriesByName('sm-map-render', 'measure').at(-1)!.duration);
    unmount();
  }
  return [...samples].sort((a, b) => a - b)[2]!;
}

describe('R-9 map render measurement (jsdom: render + commit, no layout or paint)', () => {
  it.skipIf(!process.env.SM_PERF)('measures the Vomero size and the SP1 worst case', () => {
    const vomero = medianRender(vomeroResult, '2027-03-15');
    const max = medianRender(sp1Max(), '2027-06-28');
    console.log(`SM_MAP_RENDER_MS vomero_median=${vomero.toFixed(1)} sp1max_median=${max.toFixed(1)}`);
    expect(Number.isFinite(vomero) && Number.isFinite(max)).toBe(true);
  }, 120_000);
});
