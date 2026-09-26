/**
 * Realistic three-product Vomero fixtures (spec §13) for BFF, component and
 * page tests. Built with small helpers so every cumulative figure is
 * internally consistent (D = Σ_v D_v; covered ≤ demand; option coverage = A/D).
 */
import type {
  DemandSchedule, SmBomLine, SmCandidateResult, SmEstimateResponse, SmExecutionDetail, SmExecutionSummary, SmMix,
  SmProduct, SmProductDetail, SmProductResult, SmProject, SmRunListResponse, SmSlotResult,
  SourcingMapExecutionResult, UtilizationBand,
} from '@haiwave/protocol';
import type { SmRunTemplate } from '../local-shapes';

export const VOMERO_IDS = {
  seat: '6ab14288-fe43-490e-bc4e-4902ce857fba',
  user: '5a1e0000-0000-4000-8000-000000000901',
  project: '5a1e0000-0000-4000-8000-000000000001',
  pegasus: '5a1e0000-0000-4000-8000-000000000011',
  court: '5a1e0000-0000-4000-8000-000000000012',
  metcon: '5a1e0000-0000-4000-8000-000000000013',
  template: '5a1e0000-0000-4000-8000-000000000021',
  execution: '5a1e0000-0000-4000-8000-000000000031',
  executionOld: '5a1e0000-0000-4000-8000-000000000032',
  leon: '5a1e0000-0000-4000-8000-000000000101',
  mekong: '5a1e0000-0000-4000-8000-000000000102',
  arno: '5a1e0000-0000-4000-8000-000000000103',
  zephyr: '5a1e0000-0000-4000-8000-000000000104',
  bowline: '5a1e0000-0000-4000-8000-000000000105',
  aglet: '5a1e0000-0000-4000-8000-000000000106',
} as const;

export const MENS_US_7_13 = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13'];
/** center 9.5, spread 1.5, half sizes; largest remainder over 10,000 hundredths (sums to exactly 100.00). */
export const SPRING_MIX: SmMix = {
  '7': 3.45, '7.5': 5.69, '8': 8.39, '8.5': 11.08, '9': 13.09, '9.5': 13.83, '10': 13.08,
  '10.5': 11.08, '11': 8.39, '11.5': 5.69, '12': 3.45, '12.5': 1.87, '13': 0.91,
};
const DROPS = ['2027-01-15', '2027-02-15', '2027-03-15', '2027-04-15', '2027-05-15', '2027-06-15'];
/** due − 21 days, rounded down to its ISO Monday (spec §8.2), measured. */
const NEED_WEEKS = ['2026-12-21', '2027-01-25', '2027-02-22', '2027-03-22', '2027-04-19', '2027-05-24'];

const TS = '2026-09-20T09:00:00.000Z';
const ANSWERED_AT = '2026-09-23T10:42:00.000Z';
const AXIS = { name: 'Size', system: "Men's US", values: MENS_US_7_13 };
const READY = { ready: true, first_failing_rule: null, detail: null };

/** JSON-safe deep copy (the fixtures hold only JSON values). */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Fixture-local largest remainder (the product code lives in demand-math.ts, Task 33). */
function split(total: number, mix: SmMix = SPRING_MIX): Record<string, number> {
  const raw = MENS_US_7_13.map((v) => (total * (mix[v] ?? 0)) / 100);
  const q = raw.map(Math.floor);
  let rem = total - q.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < order.length && rem > 0; k++, rem--) q[order[k]![1]]! += 1;
  return Object.fromEntries(MENS_US_7_13.map((v, i) => [v, q[i]!]));
}

export const vomeroProject: SmProject = {
  project_id: VOMERO_IDS.project,
  name: 'Spring 2027',
  description: 'Line A: three colorways for the spring drop calendar.',
  created_by_user_id: VOMERO_IDS.user,
  created_at: TS,
  updated_at: TS,
  archived_at: null,
  run_count: 1,
  product_count: 3,
  last_activity_at: ANSWERED_AT,
};

function product(id: string, name: string, extra: Partial<SmProduct>): SmProduct {
  return {
    product_id: id, project_id: VOMERO_IDS.project, name, unit_label: 'pairs', bom_source: 'workbench',
    agent_root_sku: null, variant_axis: AXIS, assembly_days: 21, created_at: TS, updated_at: TS,
    line_count: 5, readiness: READY, ...extra,
  };
}

export const vomeroProducts: SmProduct[] = [
  product(VOMERO_IDS.pegasus, 'Pegasus Trail', {}),
  product(VOMERO_IDS.court, 'Court Classic', { line_count: 4 }),
  product(VOMERO_IDS.metcon, 'Metcon Iron', { bom_source: 'agent', agent_root_sku: 'METCON-CROSS-IRON', line_count: 2 }),
];

function line(n: number, productId: string, l: Omit<SmBomLine, 'line_id' | 'product_id' | 'position'>): SmBomLine {
  return { line_id: `5a1e0000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`, product_id: productId, position: n, ...l };
}

export const vomeroWorkbenchDetail: SmProductDetail = {
  ...vomeroProducts[0]!,
  lines_fetched_at: null,
  // d-G5: display data per class; the dangling slug keeps { label: slug, class_path: [slug] } (contract §10)
  classes: {
    cpt_full_grain_leather_hides: { label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] },
    cpt_eva_foam_midsole: { label: 'cpt_eva_foam_midsole', class_path: ['cpt_eva_foam_midsole'] },
    cpt_rubber_outsoles: { label: 'Rubber outsoles', class_path: ['Components', 'Outsoles', 'Rubber outsoles'] },
    cpt_metal_eyelets: { label: 'Metal eyelets', class_path: ['Components', 'Trims', 'Eyelets', 'Metal eyelets'] },
    cpt_flat_laces: { label: 'Flat laces', class_path: ['Components', 'Trims', 'Laces', 'Flat laces'] },
  },
  lines: [
    line(0, VOMERO_IDS.pegasus, {
      component_label: 'Upper leather, tumbled', part_ref: 'LTH-4471', class_id: 'cpt_full_grain_leather_hides',
      uom: 'sq ft', qty_per_unit: 0.25, variant_bound: true, qty_by_variant: null,
      pins: [
        { supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 60 },
        { supplier_participant_id: VOMERO_IDS.mekong, supplier_sku: 'MK-FG-HIDE-2', share_pct: 40 },
      ],
      origin: 'authored', note: null,
    }),
    line(1, VOMERO_IDS.pegasus, {
      component_label: 'EVA midsole', part_ref: null, class_id: 'cpt_eva_foam_midsole', uom: 'pr', qty_per_unit: 1,
      variant_bound: false, qty_by_variant: null, pins: [], origin: 'authored', note: null,
    }),
    line(2, VOMERO_IDS.pegasus, {
      component_label: 'Rubber outsole', part_ref: 'OUT-R2', class_id: 'cpt_rubber_outsoles', uom: 'pr', qty_per_unit: 1,
      variant_bound: true, qty_by_variant: null,
      pins: [{ supplier_participant_id: VOMERO_IDS.zephyr, supplier_sku: 'ZC-OUT-R2', share_pct: 100 }],
      origin: 'authored', note: null,
    }),
    line(3, VOMERO_IDS.pegasus, {
      component_label: 'Metal eyelet 5mm', part_ref: null, class_id: 'cpt_metal_eyelets', uom: 'ea', qty_per_unit: 12,
      variant_bound: false, qty_by_variant: null, pins: [], origin: 'uploaded',
      note: "Supplier 'Kwang Il' is not a trading partner",
    }),
    line(4, VOMERO_IDS.pegasus, {
      component_label: 'Flat lace 137 cm', part_ref: null, class_id: 'cpt_flat_laces', uom: 'pr', qty_per_unit: 1,
      variant_bound: false, qty_by_variant: null, pins: [], origin: 'authored', note: null,
    }),
  ],
};

export const vomeroAgentDetail: SmProductDetail = {
  ...vomeroProducts[2]!,
  // a-G9: read live on GET; this is the time of that read
  lines_fetched_at: '2026-09-22T14:00:00.000Z',
  classes: {
    cpt_full_grain_leather_hides: { label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] },
  },
  lines: [
    line(10, VOMERO_IDS.metcon, {
      component_label: 'Upper leather, tumbled', part_ref: 'LC-BOV-UP-01', class_id: 'cpt_full_grain_leather_hides',
      uom: 'sq ft', qty_per_unit: 0.25, variant_bound: false, qty_by_variant: null,
      pins: [{ supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 100 }],
      origin: 'agent_import', note: null,
    }),
    line(11, VOMERO_IDS.metcon, {
      component_label: 'Flat lace 137 cm', part_ref: 'BW-LACE-137', class_id: null, uom: 'pr', qty_per_unit: 1,
      variant_bound: false, qty_by_variant: null,
      pins: [{ supplier_participant_id: VOMERO_IDS.bowline, supplier_sku: 'BW-LACE-137', share_pct: 100 }],
      origin: 'agent_import', note: null,
    }),
  ],
};

function flatDemand(perDrop: number): DemandSchedule {
  return {
    drops: DROPS.map((d) => ({ due_date: d, qty: perDrop, mix_override: null })),
    mix: SPRING_MIX,
    generator: {
      total: perDrop * DROPS.length, first_due_date: DROPS[0]!, spacing: 'monthly', count: DROPS.length, shape: 'flat',
      curve: { center: '9.5', spread: 1.5, half_sizes: true },
    },
  };
}

export const vomeroRunTemplate: SmRunTemplate = {
  template_id: VOMERO_IDS.template,
  initiator_participant_id: VOMERO_IDS.seat,
  template_name: 'Line A base',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 365,
  created_at: TS,
  created_by_user_id: VOMERO_IDS.user,
  last_run_id: null,
  last_run_at: ANSWERED_AT,
  observation_class: 'sourcing_map',
  scope: {
    kind: 'sourcing_map',
    project_id: VOMERO_IDS.project,
    products: [
      { product_id: VOMERO_IDS.pegasus, demand: flatDemand(6000) },
      { product_id: VOMERO_IDS.court, demand: flatDemand(5000) },
      { product_id: VOMERO_IDS.metcon, demand: flatDemand(5000) },
    ],
    depth_cap: 5,
    seat_weekly_capacity: 18000,
  },
};

// ---- result -----------------------------------------------------------------
const PAIRS_PER_DROP = 16000; // 6000 + 5000 + 5000
const cumPairs = (i: number) => PAIRS_PER_DROP * (i + 1);

const PRODUCT_COVERAGE: Record<string, number[]> = {
  [VOMERO_IDS.pegasus]: [1, 1, 0.72, 0.88, 0.93, 0.95],
  [VOMERO_IDS.court]: [1, 1, 0.66, 0.82, 0.87, 0.9],
  [VOMERO_IDS.metcon]: [1, 1, 0.65, 0.8, 0.86, 0.87],
};
const PER_DROP: Record<string, number> = { [VOMERO_IDS.pegasus]: 6000, [VOMERO_IDS.court]: 5000, [VOMERO_IDS.metcon]: 5000 };
const NAMES: Record<string, string> = { [VOMERO_IDS.pegasus]: 'Pegasus Trail', [VOMERO_IDS.court]: 'Court Classic', [VOMERO_IDS.metcon]: 'Metcon Iron' };

function composedProduct(id: string): SmProductResult {
  return {
    product_id: id, name: NAMES[id]!, status: 'composed', failure: null,
    drops: DROPS.map((d, i) => {
      const qty = PER_DROP[id]! * (i + 1);
      const coverage = PRODUCT_COVERAGE[id]![i]!;
      return { due_date: d, qty, covered: Math.floor(coverage * qty), coverage, by_variant: null };
    }),
  };
}

function portfolioOf(products: SmProductResult[], seatCapacityApplied: boolean): SourcingMapExecutionResult['portfolio'] {
  const composed = products.filter((p) => p.status === 'composed');
  if (composed.length === 0) return { drops: [], first_short_drop: null, seat_capacity_applied: false };
  const drops = DROPS.map((d, i) => {
    const demand = composed.reduce((a, p) => a + p.drops[i]!.qty, 0);
    const covered = composed.reduce((a, p) => a + p.drops[i]!.covered, 0);
    return { due_date: d, demand, covered, coverage: demand === 0 ? 1 : covered / demand };
  });
  return { drops, first_short_drop: drops.find((x) => x.coverage < 1)?.due_date ?? null, seat_capacity_applied: seatCapacityApplied };
}

interface CandidateInput {
  id: string; name: string; country: string; sku: string; classId: string; classPath: string[];
  pinned: boolean; share: number; status: SmCandidateResult['status']; achievable: number[] | null;
  byVariant: Array<Record<string, number>> | null; demand: number[]; limit: SmCandidateResult['limit'];
  lead: number | null; band: UtilizationBand | null; seq: number;
}
function candidate(c: CandidateInput): SmCandidateResult {
  const answered = c.status === 'answered' || c.status === 'unsupported';
  return {
    supplier_participant_id: c.id, supplier_name: c.name, supplier_country: c.country, supplier_sku: c.sku,
    class_id: c.classId, class_path: c.classPath, pinned: c.pinned, allocation_share_pct: c.share, status: c.status,
    availability_form: 'quantity', answered_at_allocation: false, spare_unknown: false, shared_candidate: false,
    weeks: answered && c.achievable
      ? NEED_WEEKS.map((w, i) => ({
          week: w,
          cum_achievable: c.achievable![i]!,
          cum_achievable_by_variant: c.byVariant ? c.byVariant[i]! : null,
          option_coverage: c.demand[i] === 0 ? 1 : Math.min(1, c.achievable![i]! / c.demand[i]!),
        }))
      : [],
    limit: answered ? c.limit : null, own_lead_time_days: answered ? c.lead : null,
    utilization_band: answered ? c.band : null, answered_at: answered ? ANSWERED_AT : null, status_seq: c.seq,
  };
}

const asOf = () => DROPS.map((d, i) => ({ drop: d, week: NEED_WEEKS[i]! }));
/** d-G8: each product's cumulative demand in a slot, index-aligned with the slot's weeks. */
function productDemand(productIds: string[], perPair: number): SmSlotResult['product_demand'] {
  return productIds.map((id) => ({ product_id: id, cum_qty: NEED_WEEKS.map((_, i) => PER_DROP[id]! * (i + 1) * perPair) }));
}
/** d-G6: the seat block SP1-b fills at execution start. */
const SEAT = { participant_id: VOMERO_IDS.seat, legal_name: 'CSG Footwear Vietnam', country: 'VN', class_label: 'Athletic footwear' };
const ALL_THREE = [VOMERO_IDS.pegasus, VOMERO_IDS.court, VOMERO_IDS.metcon];
const LEATHER_PATH = ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'];

function leatherSlot(): SmSlotResult {
  const D = NEED_WEEKS.map((_, i) => cumPairs(i) / 4); // 0.25 sq ft per pair
  const leon = [2400, 4800, 5000, 7500, 9800, 12000];
  // integer arithmetic: 60% / 40% of a multiple of 4,000 stays an integer
  const covered = D.map((d, i) => Math.min(leon[i]!, (d * 6) / 10) + (d * 4) / 10);
  return {
    slot_key: { class_id: 'cpt_full_grain_leather_hides', uom: 'sq ft', variant_bound: true, variant_system: "Men's US" },
    class_label: 'Full grain leather hides', class_path: LEATHER_PATH, product_ids: ALL_THREE,
    demand: NEED_WEEKS.map((w, i) => ({ week: w, cum_qty: D[i]!, cum_qty_by_variant: split(D[i]!) })),
    coverage: NEED_WEEKS.map((w, i) => {
      const byVariant = split(covered[i]!);
      const demandV = split(D[i]!);
      return {
        week: w, covered: covered[i]!, coverage: covered[i]! / D[i]!, covered_by_variant: byVariant,
        coverage_by_variant: Object.fromEntries(MENS_US_7_13.map((v) => [v, demandV[v] === 0 ? 1 : Math.min(1, byVariant[v]! / demandV[v]!)])),
      };
    }),
    observed: false, no_publisher: false, not_probed_count: 0, as_of_weeks: asOf(),
    product_demand: productDemand(ALL_THREE, 0.25),
    candidates: [
      candidate({ id: VOMERO_IDS.leon, name: 'León Cuero', country: 'MX', sku: 'LC-BOV-UP-01', classId: 'cpt_full_grain_leather_hides',
        classPath: LEATHER_PATH, pinned: true, share: 60, status: 'answered', achievable: leon, byVariant: leon.map((a) => split(a)),
        demand: D, limit: 'own', lead: 38, band: 'at_capacity', seq: 2 }),
      candidate({ id: VOMERO_IDS.mekong, name: 'Mekong Tannery', country: 'VN', sku: 'MK-FG-HIDE-2', classId: 'cpt_full_grain_leather_hides',
        classPath: LEATHER_PATH, pinned: true, share: 40, status: 'answered', achievable: D, byVariant: D.map((d) => split(d)),
        demand: D, limit: null, lead: 24, band: 'moderate', seq: 3 }),
      candidate({ id: VOMERO_IDS.arno, name: 'Arno Pelli', country: 'IT', sku: 'AP-VITELLO-9', classId: 'cpt_full_grain_leather_hides',
        classPath: LEATHER_PATH, pinned: false, share: 0, status: 'timeout', achievable: null, byVariant: null,
        demand: D, limit: null, lead: null, band: null, seq: 7 }),
    ],
  };
}

function simpleSlot(classId: string, label: string, path: string[], uom: string, perPair: number, productIds: string[],
  candidates: (D: number[]) => SmCandidateResult[], noPublisher = false): SmSlotResult {
  const pairs = productIds.reduce((a, id) => a + PER_DROP[id]!, 0);
  const D = NEED_WEEKS.map((_, i) => pairs * (i + 1) * perPair);
  const cands = candidates(D);
  const answered = cands.filter((c) => c.status === 'answered');
  const covered = D.map((d, i) => Math.min(d, answered.reduce((a, c) => a + c.weeks[i]!.cum_achievable, 0)));
  return {
    slot_key: { class_id: classId, uom, variant_bound: false, variant_system: null }, class_label: label, class_path: path, product_ids: productIds,
    demand: NEED_WEEKS.map((w, i) => ({ week: w, cum_qty: D[i]!, cum_qty_by_variant: null })),
    coverage: NEED_WEEKS.map((w, i) => ({ week: w, covered: covered[i]!, coverage: D[i] === 0 ? 1 : covered[i]! / D[i]!, covered_by_variant: null, coverage_by_variant: null })),
    observed: true, no_publisher: noPublisher, not_probed_count: 0, as_of_weeks: asOf(), candidates: cands,
    product_demand: productDemand(productIds, perPair),
  };
}

function outsoleSlot(): SmSlotResult {
  const OUTSOLE_PATH = ['Components', 'Outsoles', 'Rubber outsoles'];
  const D = NEED_WEEKS.map((_, i) => cumPairs(i));
  const DV = D.map((d) => split(d));
  const AV = DV.map((dv, i) => Object.fromEntries(MENS_US_7_13.map((v) => [v, i >= 2 && (v === '9' || v === '10') ? Math.floor(dv[v]! * 0.8) : dv[v]!])));
  const A = AV.map((av) => Object.values(av).reduce((a, b) => a + b, 0));
  return {
    slot_key: { class_id: 'cpt_rubber_outsoles', uom: 'pr', variant_bound: true, variant_system: "Men's US" },
    class_label: 'Rubber outsoles', class_path: OUTSOLE_PATH, product_ids: ALL_THREE,
    demand: NEED_WEEKS.map((w, i) => ({ week: w, cum_qty: D[i]!, cum_qty_by_variant: DV[i]! })),
    coverage: NEED_WEEKS.map((w, i) => ({
      week: w, covered: A[i]!, coverage: A[i]! / D[i]!, covered_by_variant: AV[i]!,
      coverage_by_variant: Object.fromEntries(MENS_US_7_13.map((v) => [v, DV[i]![v] === 0 ? 1 : AV[i]![v]! / DV[i]![v]!])),
    })),
    observed: true, no_publisher: false, not_probed_count: 0, as_of_weeks: asOf(),
    product_demand: productDemand(ALL_THREE, 1),
    candidates: [
      candidate({ id: VOMERO_IDS.zephyr, name: 'Zephyr Compounds', country: 'DE', sku: 'ZC-OUT-R2', classId: 'cpt_rubber_outsoles',
        classPath: OUTSOLE_PATH, pinned: true, share: 100, status: 'answered', achievable: A, byVariant: AV,
        demand: D, limit: 'own', lead: 20, band: 'high', seq: 4 }),
    ],
  };
}

function buildSlots(): SmSlotResult[] {
  const LACE_PATH = ['Components', 'Trims', 'Laces', 'Flat laces'];
  return [
    leatherSlot(),
    simpleSlot('cpt_eva_foam_midsole', 'cpt_eva_foam_midsole', ['cpt_eva_foam_midsole'], 'pr', 1, ALL_THREE, (D) => [
      candidate({ id: VOMERO_IDS.zephyr, name: 'Zephyr Compounds', country: 'DE', sku: 'ZC-EVA-MS', classId: 'cpt_eva_foam_midsole',
        classPath: ['cpt_eva_foam_midsole'], pinned: false, share: 0, status: 'answered', achievable: D, byVariant: null,
        demand: D, limit: null, lead: 20, band: 'high', seq: 5 }),
    ]),
    outsoleSlot(),
    simpleSlot('cpt_metal_eyelets', 'Metal eyelets', ['Components', 'Trims', 'Eyelets', 'Metal eyelets'], 'ea', 12,
      [VOMERO_IDS.pegasus, VOMERO_IDS.court], () => [], true),
    simpleSlot('cpt_flat_laces', 'Flat laces', LACE_PATH, 'pr', 1, ALL_THREE, (D) => [
      candidate({ id: VOMERO_IDS.bowline, name: 'Bowline Cordage', country: 'PT', sku: 'BW-LACE-137', classId: 'cpt_flat_laces',
        classPath: LACE_PATH, pinned: false, share: 0, status: 'answered', achievable: D, byVariant: null,
        demand: D, limit: null, lead: 12, band: 'low', seq: 1 }),
      candidate({ id: VOMERO_IDS.aglet, name: 'Aglet & Cord', country: 'IN', sku: 'AC-FLAT-137', classId: 'cpt_flat_laces',
        classPath: LACE_PATH, pinned: false, share: 0, status: 'answered', achievable: D.map((d, i) => (i === 0 ? 0 : d)), byVariant: null,
        demand: D, limit: 'lead_time', lead: 45, band: 'moderate', seq: 6 }),
    ]),
  ];
}

function buildResult(products: SmProductResult[]): SourcingMapExecutionResult {
  return { complete: true, seat: SEAT, portfolio: portfolioOf(products, true), products, slots: buildSlots(), answers_as_of: ANSWERED_AT };
}

export const vomeroResult: SourcingMapExecutionResult = buildResult(ALL_THREE.map(composedProduct));

export const vomeroExecution: SmExecutionSummary = {
  execution_id: VOMERO_IDS.execution,
  template_id: VOMERO_IDS.template,
  template_name: 'Line A base',
  status: 'completed',
  failure_reason: null,
  trigger: 'manual',
  started_at: '2026-09-23T10:40:00.000Z',
  completed_at: '2026-09-23T10:42:30.000Z',
  probes_planned: 7,
  probes_done: 7,
  gap_counts: { timeout: 1 },
  portfolio_coverage_last_drop: vomeroResult.portfolio.drops[5]!.coverage,
  first_short_drop: vomeroResult.portfolio.first_short_drop,
  archived_at: null,
  created_at: '2026-09-23T10:40:00.000Z',
};

export const vomeroDetail: SmExecutionDetail = { execution: vomeroExecution, result: vomeroResult };

export const vomeroRunList: SmRunListResponse = {
  runs: [{ template_id: VOMERO_IDS.template, template_name: 'Line A base', product_count: 3, cadence: { kind: 'manual_only' }, last_execution: vomeroExecution }],
};

export const vomeroEstimate: SmEstimateResponse = {
  readiness: { ready: true, first_failing_rule: null, detail: null },
  slot_count: 5,
  probe_count: 7,
  probe_count_worst_case: 10,
  responders_short: [],
};

/** A running execution: León answered; Mekong and Arno still probing; composition partial. */
export function runningDetail(): SmExecutionDetail {
  const result = clone(vomeroResult);
  result.complete = false;
  const leather = result.slots[0]!;
  for (const c of leather.candidates.slice(1)) {
    c.status = 'probing'; c.weeks = []; c.limit = null; c.own_lead_time_days = null; c.utilization_band = null; c.answered_at = null;
  }
  return {
    execution: { ...vomeroExecution, status: 'running', completed_at: null, probes_done: 3, gap_counts: {}, portfolio_coverage_last_drop: null },
    result,
  };
}

/** Metcon's agent BOM was unavailable: the product failed; the rest composed (spec §8.1). */
export function resultWithAgentFailure(): SourcingMapExecutionResult {
  const products = ALL_THREE.map(composedProduct);
  products[2] = { product_id: VOMERO_IDS.metcon, name: 'Metcon Iron', status: 'failed', failure: 'agent_bom_unavailable', drops: [] };
  return buildResult(products);
}

/** Every product failed to explode: no slots, no portfolio drops (Review Focus 5). */
export function zeroSlotResult(): SourcingMapExecutionResult {
  const products: SmProductResult[] = ALL_THREE.map((id) => ({ product_id: id, name: NAMES[id]!, status: 'failed', failure: 'agent_bom_unavailable', drops: [] }));
  return { complete: true, seat: SEAT, portfolio: { drops: [], first_short_drop: null, seat_capacity_applied: false }, products, slots: [], answers_as_of: null };
}

/** n weekly portfolio drops from 2027-01-04 (for the >12-drop strip); slots unchanged. */
export function weeklyDropsResult(n: number): SourcingMapExecutionResult {
  const result = clone(vomeroResult);
  const start = Date.parse('2027-01-04T00:00:00Z');
  result.portfolio.drops = Array.from({ length: n }, (_, i) => {
    const due = new Date(start + i * 7 * 86400000).toISOString().slice(0, 10);
    const demand = 2000 * (i + 1);
    const coverage = i % 9 === 4 ? 0.64 : i % 5 === 3 ? 0.81 : 1;
    return { due_date: due, demand, covered: Math.floor(coverage * demand), coverage };
  });
  result.portfolio.first_short_drop = result.portfolio.drops.find((d) => d.coverage < 1)?.due_date ?? null;
  return result;
}
