/** Pure selectors for the run workspace map (spec §9.3). */
import type { SmCandidateLiveStatus, SmCandidateResult } from '../contract';
import type { SmCandidateWeek, SmOptionLimit, SmPortfolioResult } from '../types';

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

/** D-148 pill wording (spec §9.3): an explicit quantity up to the ask, a verdict, or not probed. */
export function availabilityText(c: SmCandidateResult, week: string | null, demand: number, uom: string): string {
  if (c.availability_form === 'not_probed_trust') return 'Not probed at this trust level';
  if (demand === 0) return 'No demand yet';
  const w = candidateWeekAt(c, week);
  if (!w) return '—';
  const full = w.cum_achievable >= demand;
  if (c.availability_form === 'verdict') return full ? 'Yes, can cover in full' : 'No, cannot cover in full';
  return full ? `Covers full ${formatQty(demand)} ${uom}` : `Can cover ${formatQty(w.cum_achievable)} of ${formatQty(demand)} ${uom}`;
}

const LIMIT_TEXT: Record<SmOptionLimit, string> = {
  own: 'Limit: own capacity',
  lead_time: 'Limit: lead time exceeds window',
  unknown: 'Schedule not assessed',
};
export function limitText(limit: SmOptionLimit | null): string {
  return limit === null ? 'No limit at the full requirement' : LIMIT_TEXT[limit];
}

const GAP_TEXT: Partial<Record<SmCandidateLiveStatus, string>> = {
  declined: 'No answer · declined',
  timeout: 'No answer · timeout',
  unreachable: 'No answer · unreachable',
  not_connected: 'No answer · not connected',
  rate_limited: 'No answer · rate limited',
  cap_reached: 'Not probed · cap reached',
  probing: 'Probing',
};
/** A card's status line when it has no answer to show; null when it answered. */
export function gapText(status: SmCandidateLiveStatus): string | null {
  return GAP_TEXT[status] ?? null;
}
