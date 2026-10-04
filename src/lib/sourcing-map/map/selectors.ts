/** Pure selectors for the run workspace map (spec §9.3). */
import type { SmCandidateStatus, SmEstimateResponse } from '@haiwave/protocol';
import type {
  SmBand, SmCandidateLiveStatus2 as SmCandidateLiveStatus, SmCandidateResult2 as SmCandidateResult, SmCandidateWeek, SmCoverageWeek, SmExecutionStatusResponse2 as SmExecutionStatusResponse,
  SmOptionAggregates, SmOptionLimit2, SmPortfolioDrop, SmPortfolioResult, SmSlotResult2 as SmSlotResult, SmSubtierNode, SmTrace, SmWaitingOn, SourcingMapExecutionResult2 as SourcingMapExecutionResult,
} from '../types';
import { SM_UNCLASSIFIED_CLASS_PREFIX, type SmSlotKey } from '@haiwave/protocol';

/** Spec §9.3 / O-2: links ≥ 90% teal, 70–90% orange, < 70% red. */
export const HEAT_GOOD = 0.9;
export const HEAT_MID = 0.7;

export type Heat = 'good' | 'mid' | 'bad';

export function heatOf(ratio: number): Heat {
  return ratio >= HEAT_GOOD ? 'good' : ratio >= HEAT_MID ? 'mid' : 'bad';
}

/** The one heat colour for pips, links, the per-size strip and the drop strip: the theme's `--sm-heat-*` variable. */
export function heatVar(ratio: number): string {
  return `var(--sm-heat-${heatOf(ratio)})`;
}

/** Floored, so 99.6% never reads as a covered-in-full 100%. */
export function formatPct(ratio: number): string {
  return `${Math.floor(ratio * 100 + 1e-9)}%`;
}

export function formatQty(n: number): string {
  return n.toLocaleString('en-US');
}

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export function formatDropDate(iso: string): string {
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

const FULL_DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** A date or an instant as "Jul 24, 2026": the year formatDropDate leaves out. */
export function formatDay(iso: string): string {
  return FULL_DATE.format(new Date(iso));
}

const AS_OF = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
/** An instant as "Sep 23, 10:42 UTC": the one "as of" format that "Answers as of" and the execution picker share (ruling R3). */
export function formatAsOfUtc(iso: string): string {
  return `${AS_OF.format(new Date(iso))} UTC`;
}

/** Spec §9.3: the first short drop, or the last drop when none is short. */
export function defaultAsOfDrop(p: SmPortfolioResult): string | null {
  return p.first_short_drop ?? p.drops[p.drops.length - 1]?.due_date ?? null;
}

/** `?drop=` when it names a portfolio drop, else the default. */
export function resolveAsOfDrop(param: string | null, p: SmPortfolioResult): string | null {
  return param !== null && p.drops.some((d) => d.due_date === param) ? param : defaultAsOfDrop(p);
}

export function candidateWeekAt(c: SmCandidateResult, week: string | null): SmCandidateWeek | null {
  return week === null ? null : c.weeks.find((w) => w.week === week) ?? null;
}

const NOT_PROBED_TRUST = 'Not probed at this trust level';
const NO_DEMAND_YET = 'No demand yet';

/**
 * D-148 pill wording (spec §9.3): an explicit quantity up to the ask, a verdict, or not probed. The figure is what
 * the supplier stated, and it is worded so (owner's walk ruling, 2026-09-29): nothing beneath tier 1 is traced.
 */
export function availabilityText(c: SmCandidateResult, week: string | null, demand: number, uom: string): string {
  if (c.availability_form === 'not_probed_trust') return NOT_PROBED_TRUST;
  if (demand === 0) return NO_DEMAND_YET;
  const w = candidateWeekAt(c, week);
  if (!w) return '—';
  const full = w.cum_achievable >= demand;
  if (c.availability_form === 'verdict') return full ? 'States it can cover in full' : 'States it cannot cover in full';
  return full ? `States the full ${formatQty(demand)} ${uom}` : `States ${formatQty(w.cum_achievable)} of ${formatQty(demand)} ${uom}`;
}

/**
 * The limit line. Central derives `limit` from the shape of the answer (haiCore compose.ts limitOf): `own` means
 * "short, and not the lead-time pattern", never that the supplier named its own capacity as the cause. A tier-1
 * answer cannot show whether the supplier or its inputs bind, so the words claim only the shortfall (owner's walk
 * ruling, 2026-09-29). "Limit: own capacity" is kept for the release that traces the inputs (SP2).
 */
const LIMIT_TEXT: Record<SmOptionLimit2, string> = {
  own: 'Short · cause not traced',
  inputs: 'Short · cause not traced',
  both: 'Short · cause not traced',
  lead_time: 'Stated supply starts after the first need date',
  unknown: 'Schedule not assessed',
};
export function limitText(limit: SmOptionLimit2 | null): string {
  return limit === null ? 'No shortfall stated' : LIMIT_TEXT[limit];
}

const GAP_TEXT: Partial<Record<SmCandidateLiveStatus, string>> = {
  declined: 'No answer · declined',
  timeout: 'No answer · timeout',
  unreachable: 'No answer · unreachable',
  not_connected: 'No answer · not connected',
  rate_limited: 'No answer · rate limited',
  cap_reached: 'Not probed · cap reached',
  probing: 'Probing',
  waiting: 'Waiting · hourly allowance',
};
/** A card's status line when it has no answer to show; null when it answered. */
export function gapText(status: SmCandidateLiveStatus): string | null {
  return GAP_TEXT[status] ?? null;
}

/**
 * What a details coverage cell says when it has no figure (AC 17): a drop with no need week yet has no demand;
 * otherwise the candidate's own gap copy or the not-probed copy, as its card shows it; "no answer" only when neither applies.
 */
export function noCoverageText(c: SmCandidateResult, week: string | null): string {
  if (week === null) return NO_DEMAND_YET;
  return gapText(c.status) ?? (c.availability_form === 'not_probed_trust' ? NOT_PROBED_TRUST : 'no answer');
}

export function slotWeekFor(slot: SmSlotResult, drop: string | null): string | null {
  if (drop === null) return null;
  return slot.as_of_weeks.find((a) => a.drop === drop)?.week ?? null;
}

export function slotDemandAt(slot: SmSlotResult, week: string | null): number {
  if (week === null) return 0;
  return slot.demand.find((d) => d.week === week)?.cum_qty ?? 0;
}

export function slotCoverageAt(slot: SmSlotResult, week: string | null): SmCoverageWeek | null {
  return week === null ? null : slot.coverage.find((c) => c.week === week) ?? null;
}

/**
 * Owner's walk ruling (2026-09-29): capacity exists for a slot when the quantities its suppliers state, taken
 * together, meet the requirement by this week (every size of it, on a size-bound slot), whether or not the
 * allocation uses them. These are the suppliers' own statements at tier 1; nothing beneath them has been traced.
 * Null when the slot has no demand row to judge.
 */
export function capacityExists(slot: SmSlotResult, week: string | null): boolean | null {
  const demand = week === null ? undefined : slot.demand.find((d) => d.week === week);
  if (!demand) return null;
  const answers = slot.candidates.flatMap((c) => candidateWeekAt(c, week) ?? []);
  const total = answers.reduce((sum, a) => sum + a.cum_achievable, 0);
  const bySize = demand.cum_qty_by_variant;
  if (!bySize) return total >= demand.cum_qty;
  // Size by size. An answer given on the total is spread over the sizes in proportion to their demand (spec §8.6).
  return Object.entries(bySize).every(([size, asked]) => {
    if (asked === 0) return true;
    const stated = answers.reduce((sum, a) => sum + (a.cum_achievable_by_variant ? a.cum_achievable_by_variant[size] ?? 0 : (a.cum_achievable * asked) / demand.cum_qty), 0);
    return stated + 1e-9 >= asked;
  });
}

export type LaneState = 'met' | 'reallocate' | 'short';

/**
 * Owner's walk ruling (2026-09-29): a lane is in one of three states at the drop shown.
 *  - `met`: the plan as allocated covers the requirement in full (the rail's "Covered 100%").
 *  - `reallocate`: the plan is short, and the suppliers' stated capacity could cover it.
 *  - `short`: the suppliers' stated capacity, taken together, cannot cover it.
 * Null when the slot has no demand row to judge.
 */
export function laneState(slot: SmSlotResult, week: string | null): LaneState | null {
  const exists = capacityExists(slot, week);
  if (exists === null) return null;
  const cov = slotCoverageAt(slot, week);
  if (cov && cov.coverage >= 1) return 'met';
  return exists ? 'reallocate' : 'short';
}

/**
 * A variant record's entries in axis order. JS objects list integer-like keys
 * ("7", "13") before the others ("7.5"), so numeric keys are sorted numerically.
 */
export function sortedVariantEntries<T>(record: Record<string, T>): Array<[string, T]> {
  const entries = Object.entries(record);
  return entries.every(([k]) => k.trim() !== '' && Number.isFinite(Number(k)))
    ? entries.sort(([a], [b]) => Number(a) - Number(b))
    : entries;
}

/** Contract §10: a slot key with no Network Index class is probed through its pin, in a slot of its own. */
function isUnclassifiedKey(key: SmSlotKey): boolean {
  return key.class_id.startsWith(SM_UNCLASSIFIED_CLASS_PREFIX);
}

/** Contract §10: an agent line with no Network Index class is probed through its pin, in a slot of its own. */
export function isUnclassifiedSlot(slot: SmSlotResult): boolean {
  return isUnclassifiedKey(slot.slot_key);
}

/** One slot-title rule for the rail and the backlog: "Unclassified · <component>" for such a slot key, otherwise the label. */
export function slotKeyTitle(key: SmSlotKey, label: string): string {
  return isUnclassifiedKey(key) ? `Unclassified · ${label}` : label;
}

/** The rail's title: "Unclassified · <component>" for such a slot, otherwise the class label. */
export function slotTitle(slot: SmSlotResult): string {
  return slotKeyTitle(slot.slot_key, slot.class_label);
}

export interface DropGroup {
  key: string;
  label: string;
  drops: SmPortfolioDrop[];
  /** the group's lowest drop coverage (a month is as short as its shortest drop) */
  coverage: number;
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Spec §9.3: the drop strip shows one segment per drop up to this many drops, and groups by month beyond it. */
export const MAX_DROP_SEGMENTS = 12;

/** Spec §9.3: one segment per drop, grouped by month beyond MAX_DROP_SEGMENTS drops. */
export function groupDrops(drops: SmPortfolioDrop[]): DropGroup[] {
  if (drops.length <= MAX_DROP_SEGMENTS) {
    return drops.map((d) => ({ key: d.due_date, label: formatDropDate(d.due_date), drops: [d], coverage: d.coverage }));
  }
  const groups: DropGroup[] = [];
  for (const d of drops) {
    const key = d.due_date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: MONTH.format(new Date(`${key}-01T00:00:00Z`)), drops: [], coverage: 1 };
      groups.push(g);
    }
    g.drops.push(d);
    g.coverage = Math.min(g.coverage, d.coverage);
  }
  return groups;
}

/** Spec §9.3: "Answers as of" warns when answers are more than 7 days old. */
export const STALE_AFTER_MS = 7 * 86_400_000;

export function answersAreStale(asOf: string, now: Date): boolean {
  return now.getTime() - Date.parse(asOf) > STALE_AFTER_MS;
}

/** Spec §8.9: the workspace polls every 1.5 s (run-detail-shell.tsx:27). */
export const SM_POLL_MS = 1500;

/** Progressive results (spec §8.9): replace each changed candidate; untouched slots keep their identity. */
export function applyStatusDelta(result: SourcingMapExecutionResult, status: SmExecutionStatusResponse): SourcingMapExecutionResult {
  if (status.changed.length === 0) return result;
  const slots = [...result.slots];
  for (const ch of status.changed) {
    const slot = slots[ch.slot_index];
    if (!slot || !slot.candidates[ch.candidate_index]) continue;
    const candidates = [...slot.candidates];
    candidates[ch.candidate_index] = ch.candidate;
    slots[ch.slot_index] = { ...slot, candidates };
  }
  return { ...result, slots };
}

// ---- SP2 (spec §12, contract §3, §10) -------------------------------------------------------------------------

/** G-4: the planner's key names a card for anchors and shared_exposure; an SP1 execution has none, so the id stands in. */
export function candidateKeyOf(c: SmCandidateResult): string {
  return c.candidate_key ?? c.supplier_participant_id;
}

const BAND_HEAT: Record<SmBand, Heat> = { slight: 'good', moderate: 'mid', severe: 'bad' };
/** Contract §10: bands reuse the SP1 heat tokens, both themes. */
export function bandVar(band: SmBand): string {
  return `var(--sm-heat-${BAND_HEAT[band]})`;
}
export function bandWord(band: SmBand): string {
  return band;
}

/** The tier the option's shortfall binds at: the trace's binding node, else the shallowest banded node, else none. */
export function bindingTier(c: SmCandidateResult): number | null {
  const binding = (c.trace?.nodes ?? []).filter((n) => n.role === 'binding').map((n) => n.tier);
  if (binding.length > 0) return Math.min(...binding);
  const banded = (c.nodes ?? []).filter((n) => n.band !== null).map((n) => n.tier);
  return banded.length > 0 ? Math.min(...banded) : null;
}

/**
 * Spec §8.2: "not fully observed below tier N", N the shallowest tier with a gap. SP2-a's composition serves it as
 * `unobserved_from_tier` (G-46), which wins. Without the field: a node flagged observed_below: false has its gap
 * beneath it (tier + 1); a candidate flagged with no node flagged has a gap directly under it (tier 2). Review Focus 5.
 */
export function unobservedTier(c: SmCandidateResult): number | null {
  if (c.unobserved_from_tier !== undefined) return c.unobserved_from_tier;
  if (c.observed_below !== false) return null;
  const flagged = (c.nodes ?? []).filter((n) => !n.observed_below).map((n) => n.tier);
  return flagged.length === 0 ? 2 : Math.min(...flagged) + 1;
}

/**
 * The card's limit line (spec §12.2). `inputs` and `both` only exist on SP2 candidates, so they read the tiered words
 * whether or not the projection (`nodes`) has arrived yet. `own` reads "Limit: own capacity" only for an SP2-shaped
 * candidate (contract G-48); an SP1 execution keeps the walk's words: its tier-1 answer cannot say whether the
 * supplier or its inputs bind (Review Focus 1).
 */
export function limitReason(c: SmCandidateResult): string {
  const tier = bindingTier(c) ?? unobservedTier(c) ?? 2;
  switch (c.limit) {
    case 'inputs': return `Limit: constraint returned by current source, tier ${tier}`;
    case 'both': return `Limit: own capacity and tier ${tier} source`;
    case 'own': return c.nodes !== undefined ? 'Limit: own capacity' : limitText(c.limit);
    case 'lead_time': return LIMIT_TEXT.lead_time;
    case 'unknown': return LIMIT_TEXT.unknown;
    case null: return 'No shortfall stated';
  }
}

export const GAP_STUB_WORD: Record<SmCandidateStatus, string> = {
  answered: 'answered', unsupported: 'unsupported', declined: 'declined', timeout: 'timeout', unreachable: 'unreachable',
  not_connected: 'not connected', rate_limited: 'rate limited', cap_reached: 'cap reached',
};
/** Contract §10: the stub at a trace gap, "not observed below: <status word>". */
export function gapStubText(status: SmCandidateStatus): string {
  return `not observed below: ${GAP_STUB_WORD[status]}`;
}

/** The candidate keys whose sub-tier nodes carry this alias, in display order (shared exposure as the map shows it). */
export function underOf(result: SourcingMapExecutionResult, alias: string): string[] {
  const keys: string[] = [];
  for (const slot of result.slots) for (const c of slot.candidates) {
    if ((c.nodes ?? []).some((n) => n.alias === alias)) keys.push(candidateKeyOf(c));
  }
  return keys;
}

/** The alias's node as one option sees it: the preferred option's copy when it has one, else the first on the map. */
export function nodeOf(result: SourcingMapExecutionResult, alias: string, preferKey?: string): SmSubtierNode | null {
  let first: SmSubtierNode | null = null;
  for (const slot of result.slots) for (const c of slot.candidates) {
    const n = (c.nodes ?? []).find((x) => x.alias === alias);
    if (!n) continue;
    if (preferKey !== undefined && candidateKeyOf(c) === preferKey) return n;
    first ??= n;
  }
  return first;
}

export interface OtherTier { tier: number; names: string[] }

/** Where else this alias sits: for each tier other than the one `origin` sees (nodes[].tier), the names of the OTHER options that see it there. Tiers ascending; names in display order. */
export function otherTiers(result: SourcingMapExecutionResult, alias: string, origin: string): OtherTier[] {
  const sees = result.slots.flatMap((s) => s.candidates).flatMap((c) => {
    const n = (c.nodes ?? []).find((x) => x.alias === alias);
    return n ? [{ key: candidateKeyOf(c), name: c.supplier_name, tier: n.tier }] : [];
  });
  const here = sees.find((x) => x.key === origin)?.tier;
  const byTier = new Map<number, string[]>();
  for (const x of sees) {
    if (x.key === origin || x.tier === here) continue;
    byTier.set(x.tier, [...(byTier.get(x.tier) ?? []), x.name]);
  }
  return [...byTier].sort(([a], [b]) => a - b).map(([tier, names]) => ({ tier, names }));
}

export interface BindingNode {
  alias: string;
  tier: number;
  options: Array<{ slot: number; candidate: number; key: string; name: string; binds_for: number }>;
}

/** Spec §12.3: every binding node on the map, once, with the options it binds in display order. */
export function bindingNodes(result: SourcingMapExecutionResult): BindingNode[] {
  const out: BindingNode[] = [];
  result.slots.forEach((slot, si) => {
    slot.candidates.forEach((c, ci) => {
      for (const n of c.trace?.nodes ?? []) {
        if (n.role !== 'binding') continue;
        const option = { slot: si, candidate: ci, key: candidateKeyOf(c), name: c.supplier_name, binds_for: n.binds_for };
        const seen = out.find((b) => b.alias === n.alias);
        if (seen) seen.options.push(option);
        else out.push({ alias: n.alias, tier: n.tier, options: [option] });
      }
    });
  });
  return out;
}

export interface BindingRow { alias: string; tier: number; band: SmBand; binds_for: number; country: string | null; classLabel: string | null }
/** The option's binding nodes, in trace order: tier, band and binds_for from trace.nodes; country and class from the SAME option's nodes[] by alias, null when it has none. */
export function bindingRows(c: SmCandidateResult): BindingRow[] {
  return (c.trace?.nodes ?? []).filter((t) => t.role === 'binding').map((t) => {
    const n = (c.nodes ?? []).find((x) => x.alias === t.alias);
    return { alias: t.alias, tier: t.tier, band: t.band, binds_for: t.binds_for, country: n?.country ?? null, classLabel: n?.class?.label ?? null };
  });
}

const PEER_LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });
/** DECISIONS §1.2: the binding source also limits other options, so splitting between them does not help. Null when nothing is shared or no peer resolves. */
export function sharedBindingText(result: SourcingMapExecutionResult, c: SmCandidateResult): string | null {
  const aliases = (c.trace?.nodes ?? []).filter((n) => n.role === 'binding' && n.binds_for > 1).map((n) => n.alias);
  const self = candidateKeyOf(c);
  const peers: string[] = [];
  for (const b of bindingNodes(result)) {
    if (!aliases.includes(b.alias)) continue;
    for (const o of b.options) if (o.key !== self && !peers.includes(o.name)) peers.push(o.name);
  }
  if (peers.length === 0) return null;
  return `The same source limits ${PEER_LIST.format(peers)}; splitting between these options will not relieve the constraint.`;
}

/** The trace as one sentence, for the overlay's accessible name: edges with bands, the binding node, the gaps. */
export function traceSentence(trace: SmTrace, names: Record<string, string>): string {
  const nameOf = (k: string) => names[k] ?? k;
  const parts = trace.edges.map((e) => `${nameOf(e.parent)} ${String.fromCharCode(0x2192)} ${e.child} (${bandWord(e.band)})`);
  for (const n of trace.nodes) {
    if (n.role === 'binding') parts.push(`binding: ${n.alias} (tier ${n.tier})${n.binds_for > 1 ? `, for ${n.binds_for} options` : ''}`);
  }
  for (const g of trace.gaps) parts.push(`not observed below ${nameOf(g.at)}: ${GAP_STUB_WORD[g.status]}`);
  return parts.join('; ');
}

/** A card has something to trace: a trace with at least one edge or gap (A2's sentence, A4's cue). */
export function traceable(c: SmCandidateResult): boolean {
  return c.trace != null && (c.trace.edges.length > 0 || c.trace.gaps.length > 0);
}

const HOUR_UTC = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
/** The hour boundary as "HH:00 UTC", in the UTC form every other instant in this app uses (formatAsOfUtc). */
export function formatHourUtc(iso: string): string {
  return `${HOUR_UTC.format(new Date(iso))} UTC`;
}

/** The em dash of the contract's copy; the one definition, imported by every later user. */
export const EM_DASH = String.fromCharCode(0x2014);

/** LF (spec §9.5): why a map control is unavailable while the execution is queued, running or throttled. */
export const RUN_NOT_COMPLETE = 'Available when the run completes.';

/**
 * Spec §12.5, contract §10 copy: the throttled banner's sentence; the fallback when nothing is known yet (before the
 * first status frame) or the waiting responder is below tier 1 and so not named (G-52).
 */
export function throttledText(w: SmWaitingOn | null): string {
  if (w === null || w.responder_name === null) return `Waiting for an hourly allowance ${EM_DASH} the run continues on its own.`;
  return `Waiting for ${w.responder_name}'s hourly allowance until ${formatHourUtc(w.refill_at)} ${EM_DASH} the run continues on its own.`;
}

/** G-2: may_wait is derived here, never sent — the responders whose planned probes exceed their remaining allowance. */
export function mayWaitNames(e: SmEstimateResponse): string[] {
  return e.responders_short.filter((r) => r.probes_planned > r.remaining_allowance).map((r) => r.legal_name);
}

/**
 * Spec §12.4: "Inputs: 3 observed, 1 not observed · binding at tier 2"; null for an SP1 candidate (no projection), and
 * null for a candidate with a gap status (M-3): one that never answered has no observed inputs, so counting zero misstates it.
 */
export function pathSummary(c: SmCandidateResult): string | null {
  if (c.nodes === undefined || gapText(c.status) !== null) return null;
  const tier = bindingTier(c);
  const base = `Inputs: ${c.nodes.length} observed, ${c.aggregates?.not_observed ?? 0} not observed`;
  return tier === null ? base : `${base} ${String.fromCharCode(0xb7)} binding at tier ${tier}`;
}

/** The card face's line for what is beneath (DECISIONS §1.3): null for a gap card or one with no aggregates. */
export function cardSummaryText(c: SmCandidateResult): string | null {
  if (c.aggregates == null || gapText(c.status) !== null) return null;
  const { responders, median_lead_time_days: median } = c.aggregates;
  const base = `${responders} ${responders === 1 ? 'responder' : 'responders'}`;
  return median === null ? base : `${base} ${String.fromCharCode(0xb7)} median ${median} d`;
}

/** The aggregates' utilization counts as words: the details panel's string, shared with the card's bar name. */
export function utilizationText(u: SmOptionAggregates['utilization']): string {
  const dot = String.fromCharCode(0xb7);
  return `${u.low} low ${dot} ${u.moderate} moderate ${dot} ${u.high} high ${dot} ${u.at_capacity} at capacity`;
}

/** candidate_key → supplier name over every slot (the handle panel's "Also supplies", the trace sentence, Shared exposure). */
export function candidateNamesOf(result: SourcingMapExecutionResult): Record<string, string> {
  return Object.fromEntries(result.slots.flatMap((s) => s.candidates.map((c) => [candidateKeyOf(c), c.supplier_name] as const)));
}

/** The availability pill's tip: why the pill is in its state, in the user's words (owner, 2026-10-01). */
export function availabilityReason(c: SmCandidateResult, week: string | null, demand: number): string | null {
  if (c.availability_form === 'not_probed_trust' || demand === 0) return null;
  const w = candidateWeekAt(c, week);
  if (!w) return null;
  if (w.cum_achievable >= demand) return 'Covers the full ask.';
  const covers = `Covers ${formatPct(w.option_coverage)} of the ask`;
  const heat = heatOf(w.option_coverage);
  if (heat === 'good') return `${covers}, which meets the ${formatPct(HEAT_GOOD)} threshold.`;
  return `${covers}, below the ${formatPct(heat === 'mid' ? HEAT_GOOD : HEAT_MID)} threshold.`;
}
