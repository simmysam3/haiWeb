import { describe, it, expect } from 'vitest';
import { vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmCandidateResult2, SmSubtierNode, SmSupplyRisk } from '@/lib/sourcing-map/types';
import {
  SmDemandExceptionListResponseSchema, SmExecutionDetailSchema, SmOptionPanelSchema, SmSupplyRiskListResponseSchema, SmTraversalSettingSchema,
} from '@haiwave/protocol';
import { multitierDetail, withRealKeys } from '../../sp2';
import supplyRisksJson from '../supply-risks.json';
import exceptionsLeonJson from '../demand-exceptions-leon.json';
import exceptionsVettaJson from '../demand-exceptions-vetta.json';
import panelLeonJson from '../option-panel-leon.json';
import panelPartialJson from '../option-panel-partial.json';
import panelUncoveredJson from '../option-panel-uncovered.json';
import settingJson from '../traversal-setting.json';
import { leonExceptions, leonPanel, notTracedDetail, partialPanel, riskOf, supplyRisksList, traversalSetting, uncoveredPanel, vettaExceptions } from '..';

describe('SP3 types (protocol 3.97.0, re-exported type-only)', () => {
  it('compiles: not_traced_below on a node (present control), the SP2 alias, and the backlog types', () => {
    const n: SmSubtierNode = { alias: 'A', tier: 2, country: null, class: null, band: null, observed_below: false, not_traced_below: true };
    const c: SmCandidateResult2 = vomeroDetail.result!.slots[0]!.candidates[0]!;
    const s: SmSupplyRisk['status'] = 'open';
    expect(n.not_traced_below).toBe(true);
    expect(c).toBeDefined();
    expect(s).toBe('open');
  });
});

describe('SP3 fixtures (contract §9)', () => {
  const LEON = VOMERO_IDS.leon;

  it('each of the seven files parses with the protocol schema; the lists are strict at the top level (R-1), the setting as served', () => {
    SmSupplyRiskListResponseSchema.strict().parse(supplyRisksJson);
    SmDemandExceptionListResponseSchema.strict().parse(exceptionsLeonJson);
    SmDemandExceptionListResponseSchema.strict().parse(exceptionsVettaJson);
    SmOptionPanelSchema.parse(panelLeonJson);
    SmOptionPanelSchema.parse(panelPartialJson);
    SmOptionPanelSchema.parse(panelUncoveredJson);
    SmTraversalSettingSchema.parse(settingJson);
    // present control for the strictness pin: an unknown top-level key is rejected
    expect(SmSupplyRiskListResponseSchema.strict().safeParse({ ...supplyRisksJson, total: 3 }).success).toBe(false);
    expect(SmDemandExceptionListResponseSchema.strict().safeParse({ ...exceptionsLeonJson, total: 3 }).success).toBe(false);
  });

  it('supply risks: exactly one row is open, contacted or resolving, and it equals open_count (contract §8/§9)', () => {
    const live = supplyRisksList.risks.filter((r) => ['open', 'contacted', 'resolving'].includes(r.status));
    expect(live).toHaveLength(1);
    expect(live).toHaveLength(supplyRisksList.open_count);
    expect(live[0]!.supplier_participant_id).toBe(LEON);
  });

  it("León's origin.class is the dev DB's value, Chemicals level 1 of 4 (G-36), not the SP2 node's Dyes", () => {
    expect(supplyRisksList.risks[0]!.origin.class).toEqual({ slug: 'cpt_chemicals', label: 'Chemicals', level: 1, of_levels: 4 });
  });

  it("León's open_map key is the key withRealKeys(multitierDetail) serves, so the deep-link tests resolve it", () => {
    const key = withRealKeys(multitierDetail).result!.slots[0]!.candidates[0]!.candidate_key;
    expect(key).toBe(JSON.stringify([LEON, 'LC-BOV-UP-01']));
    expect(supplyRisksList.risks[0]!.open_map!.option_key).toBe(`0:${key}`);
  });

  it('the raw supply-risks JSON carries none of the keys contract §3 ("None of these carries…") keeps off the wire, outside origin.class', () => {
    const banned = ['binding_class_slug', 'signature', 'alias', 'display_class', 'composite_score', 'trust_tier', 'label'];
    const walk = (v: unknown, path: string, hits: string[]) => {
      if (Array.isArray(v)) v.forEach((x) => walk(x, path, hits));
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (banned.includes(k) && !path.endsWith('origin.class')) hits.push(`${path}.${k}`);
          walk(x, `${path}.${k}`, hits);
        }
      }
    };
    const hits: string[] = [];
    walk(supplyRisksJson, '', hits);
    expect(hits).toEqual([]);
    // present control: the walk finds a planted key
    const planted: string[] = [];
    walk({ risks: [{ origin: { alias: 'A' } }] }, '', planted);
    expect(planted).toHaveLength(1);
  });

  it('León exceptions (contract §8): Chain 13000 → 9821, gap 3179; Posture has null answered and gap; one request_closed', () => {
    const [chain, posture, own] = leonExceptions.exceptions;
    expect(chain!.cause).toBe('chain');
    expect(chain!.answered).toBe(9821);
    expect(chain!.gap).toBe(chain!.asked - chain!.answered!);
    expect(chain!.gap).toBe(3179);
    expect(posture!.cause).toBe('posture');
    expect(posture!.answered).toBeNull();
    expect(posture!.gap).toBeNull();
    expect(posture!.asked).toBe(4000);
    expect(posture!.short_week).toBe('2026-12-21');
    expect(posture!.window).toEqual({ first: '2026-12-21', last: '2027-05-24' });
    expect(own!.cause).toBe('own_capacity');
    expect(leonExceptions.exceptions.filter((e) => e.request_status === 'request_closed')).toEqual([own]);
    expect(leonExceptions.exceptions.every((e) => e.requestor.participant_id === VOMERO_IDS.seat)).toBe(true);
  });

  it("Vetta's exception is León's own-capacity request in Vetta's units (G-6), never CSG", () => {
    const e = vettaExceptions.exceptions[0]!;
    expect(e.gap).toBe(e.asked - e.answered!);
    expect(e.requestor.participant_id).toBe(LEON);
    expect(e.requestor.participant_id).not.toBe(VOMERO_IDS.seat);
  });

  it('panels: León four dimensions with two provisional, p50 42/4 and one event; partial and uncovered null their history', () => {
    expect(leonPanel.scorecard!.dimensions).toHaveLength(4);
    expect(leonPanel.scorecard!.dimensions.filter((d) => d.provisional).map((d) => d.key)).toEqual(['price_adherence', 'agent_uptime']);
    expect(leonPanel.delivery_history!.lead_time).toEqual({ kind: 'calibrated_median', days: 42, sample_count: 4 });
    expect(leonPanel.delivery_history!.events).toHaveLength(1);
    expect(leonPanel.unavailable).toEqual([]);
    expect(partialPanel.scorecard!.dimensions.map((d) => d.key)).toEqual(['fulfillment_reliability', 'price_adherence', 'agent_uptime']);
    expect(partialPanel.delivery_history).toBeNull();
    expect(partialPanel.unavailable).toEqual(['delivery_history']);
    expect(uncoveredPanel.scorecard!.dimensions).toHaveLength(4);
    expect(uncoveredPanel.delivery_history).toBeNull();
    expect(uncoveredPanel.unavailable).toEqual([]);
  });

  it("the traversal setting is León's reset state", () => {
    expect(traversalSetting).toEqual({ answer_for_myself_only: false });
  });

  it('not traced (derived): parses under 3.97.0 keeping the flag; León has no nodes or trace; nobody shares exposure under León; Mekong still has A', () => {
    const parsed = SmExecutionDetailSchema.parse(notTracedDetail);
    const leon = parsed.result!.slots[0]!.candidates[0]!;
    expect(leon.not_traced_below).toBe(true);
    expect(leon.observed_below).toBe(false);
    expect(leon.nodes).toEqual([]);
    expect(leon.trace).toBeNull();
    expect(leon.aggregates).toBeNull();
    expect(leon.limit).toBe('own');
    expect(leon.unobserved_from_tier).toBe(2);
    const shared = parsed.result!.shared_exposure!;
    const leonKey = JSON.stringify([LEON, 'LC-BOV-UP-01']);
    expect(shared.some((s) => s.under.includes(leonKey))).toBe(false);
    expect(shared.map((s) => s.alias)).toEqual(['D']); // A and C were left under Mekong alone, so they are dropped
    expect(parsed.result!.slots[0]!.candidates[1]!.nodes!.map((n) => n.alias)).toContain('A');
  });

  it('the copy is deep: multitierDetail still gives León its three nodes after notTracedDetail is built', () => {
    expect(notTracedDetail).not.toBe(multitierDetail);
    expect(multitierDetail.result!.slots[0]!.candidates[0]!.nodes).toHaveLength(3);
    expect(multitierDetail.result!.shared_exposure![0]!.under).toEqual(['leon', 'mekong']);
  });

  it('riskOf starts from León\'s row, applies overrides, and returns a fresh object each call', () => {
    expect(riskOf({ status: 'contacted' }).status).toBe('contacted');
    expect(riskOf().risk_id).toBe(supplyRisksList.risks[0]!.risk_id);
    expect(riskOf()).not.toBe(riskOf());
    expect(riskOf()).toEqual(supplyRisksList.risks[0]);
  });
});
