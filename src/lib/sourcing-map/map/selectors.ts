/** Pure selectors for the run workspace map (spec §9.3). */
import type { SmPortfolioResult } from '../types';

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
