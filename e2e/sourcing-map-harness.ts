import type { Page } from '@playwright/test';
import path from 'node:path';

/**
 * Shared browser-harness helpers (SP2 Task 13, moved here by SP3-d Task 12): axe, the render-measure reader and the
 * option-card overflow measure, used by the SP2 and SP3 harness specs.
 */

/** axe-core 4.11.1, a dev transitive dependency already in node_modules (package-lock.json:3393); injected, not bundled. */
const AXE = path.join(process.cwd(), 'node_modules/axe-core/axe.min.js');
export interface AxeViolation { id: string; impact: string | null; nodes: Array<{ target: string[] }> }
export async function axe(page: Page, root = '[data-testid="sm-root"]'): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async (selector) => {
    const runner = (window as unknown as { axe: { run(ctx: Element, opts: unknown): Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await runner.run(document.querySelector(selector)!, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations;
  }, root);
}
export function axeLine(violations: AxeViolation[]): string {
  return JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(' ')) })));
}

export function durations(page: Page, name: string): Promise<number[]> {
  return page.evaluate((n) => performance.getEntriesByName(n, 'measure').map((e) => e.duration), name);
}

export interface CardBox {
  name: string; scrollHeight: number; clientHeight: number;
  /** lines the card's flex column squeezed below their content (only a child whose overflow is not visible can shrink so) */
  squeezed: Array<{ text: string; scrollHeight: number; clientHeight: number }>;
}
/**
 * R2: every option card in the map, with its content height against its box (a card overflows when content > box).
 * The card is a flex column, so a short box first shrinks a `truncate` line (overflow hidden, so no content minimum),
 * down to nothing, before anything spills: a squeezed line is overflow too, which scrollHeight alone does not show.
 */
export function cardBoxes(page: Page): Promise<CardBox[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('section[aria-label="Sourcing map"] article')).map((a) => ({
      name: a.querySelector('button[data-anchor]')?.getAttribute('data-anchor') ?? '?',
      scrollHeight: a.scrollHeight,
      clientHeight: a.clientHeight,
      squeezed: Array.from(a.children as HTMLCollectionOf<HTMLElement>)
        .filter((c) => getComputedStyle(c).overflowY !== 'visible' && c.clientHeight < c.scrollHeight - 1)
        .map((c) => ({ text: (c.textContent ?? '').slice(0, 60), scrollHeight: c.scrollHeight, clientHeight: c.clientHeight })),
    })),
  );
}
export const overflowing = (cards: CardBox[]) => cards.filter((c) => c.scrollHeight > c.clientHeight + 1 || c.squeezed.length > 0);
