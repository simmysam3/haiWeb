// src/app/sourcing-map/__fixtures__/lf/index.ts
/**
 * LF's fixtures: the one module. `compareDetail` is the multitier detail with the deltas that the compare features
 * need (spec §9.2); the multitier itself is never edited (a deep copy), so the SP2 and SP3 tests keep the story they pin.
 */
import type { SmCandidateResult2, SmExecutionDetail2, SmOptionPanel, SmTrace } from '@/lib/sourcing-map/types';
import { multitierDetail } from '../sp2';
import p90PanelJson from './option-panel-p90.json';

/** The shallowest tier at which C sits: Mekong's, one tier above León's (which keeps the multitier's 3). */
const C_AT_MEKONG = 2;

/** D binds both FlowKnit and Bowline: the same node, severe, binding for two options. */
const bindingD = (parent: string): SmTrace => ({
  nodes: [{ alias: 'D', tier: 2, role: 'binding', band: 'severe', binds_for: 2 }],
  edges: [{ parent, child: 'D', band: 'severe' }],
  gaps: [],
});

function buildCompareDetail(): SmExecutionDetail2 {
  const detail = JSON.parse(JSON.stringify(multitierDetail)) as SmExecutionDetail2;
  const result = detail.result!;
  const options = result.slots.flatMap((s) => s.candidates);
  const option = (key: string): SmCandidateResult2 => options.find((c) => c.candidate_key === key)!;
  const node = (key: string, alias: string) => option(key).nodes!.find((n) => n.alias === alias)!;

  // León: a node with no class, and a row that says "not observed below"
  node('leon', 'B').class = null;
  node('leon', 'B').observed_below = false;

  // Mekong: a repeated country and class (F joins A as IT / Dyes), C one tier up, and a clear modal band
  node('mekong', 'F').country = 'IT';
  node('mekong', 'F').class = node('mekong', 'A').class;
  node('mekong', 'C').tier = C_AT_MEKONG;
  const mekong = option('mekong');
  mekong.aggregates!.utilization = { low: 0, moderate: 2, high: 1, at_capacity: 0 };
  mekong.aggregates!.countries = ['IN', 'IT'];

  // FlowKnit and Bowline: two traced options with the same binding node
  for (const key of ['flowknit', 'bowline']) {
    option(key).limit = 'inputs';
    node(key, 'D').band = 'severe';
    option(key).trace = bindingD(key);
  }

  result.shared_exposure!.find((e) => e.alias === 'C')!.tier = C_AT_MEKONG;
  return detail;
}

export const compareDetail = buildCompareDetail();

/** León's panel with a calibrated p50 of 30 d and a p90 of 45 d: the direct supplier's lead time at protocol 3.99.0 (§8.4). */
export const p90Panel = p90PanelJson as unknown as SmOptionPanel;
