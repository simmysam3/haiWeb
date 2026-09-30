import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Sourcing Map SP2 (spec §12.6): the run workspace on the SP2-0 fixtures in a real browser, through the dev-only
 * harness route /sm-harness/<fixture> (served only by a server started with SM_HARNESS=1; plan Task 13). Measures
 * the map render (R-9, < 200 ms) and the trace draw (< 100 ms), checks the trace's real geometry, and runs axe with
 * a trace selected in both themes. Also measures what jsdom cannot lay out (Task 13 rulings R2, R3): no option card
 * overflows its box in either theme, and a gap stub's label neither paints over another card nor is clipped.
 * Skips — never throws — without SM_HARNESS_URL (e.g. http://localhost:3111).
 * The live-seed walk (Task 14) is the second describe below.
 */
const HARNESS = process.env.SM_HARNESS_URL;
const FIXTURES = path.join(process.cwd(), 'src/app/sourcing-map/__fixtures__/sp2');
const estimate = JSON.parse(readFileSync(path.join(FIXTURES, 'estimate-may-wait.json'), 'utf8')) as unknown;
const throttled = JSON.parse(readFileSync(path.join(FIXTURES, 'execution-throttled.json'), 'utf8')) as { status: unknown };
/** axe-core 4.11.1, a dev transitive dependency already in node_modules (package-lock.json:3393); injected, not bundled. */
const AXE = path.join(process.cwd(), 'node_modules/axe-core/axe.min.js');
/** The multitier fixture's option cards: leather (León, Mekong, Arno's timeout), knit uppers, laces, outsoles. */
const MULTITIER_CARDS = 6;

async function routeBff(page: Page): Promise<void> {
  await page.route('**/api/account/sourcing-map/runs/*/estimate', (route) => route.fulfill({ json: estimate }));
  await page.route('**/api/account/sourcing-map/executions/*/status**', (route) => route.fulfill({ json: throttled.status }));
}

interface AxeViolation { id: string; impact: string | null; nodes: Array<{ target: string[] }> }
async function axe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run(ctx: Element, opts: unknown): Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await runner.run(document.querySelector('[data-testid="sm-root"]')!, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations;
  });
}
function axeLine(violations: AxeViolation[]): string {
  return JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(' ')) })));
}

function durations(page: Page, name: string): Promise<number[]> {
  return page.evaluate((n) => performance.getEntriesByName(n, 'measure').map((e) => e.duration), name);
}

/**
 * For information, not a verdict: each commit clears the previous measure, so the timeline holds only the latest one.
 * An observer installed before the page's scripts sees every measure as it is made, the hydration commit included.
 */
async function observeMeasures(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: Array<{ name: string; duration: number }> = [];
    (window as unknown as { __smMeasures: typeof seen }).__smMeasures = seen;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.name.startsWith('sm-')) seen.push({ name: e.name, duration: e.duration });
    }).observe({ type: 'measure', buffered: true });
  });
}
function observed(page: Page, name: string): Promise<number[]> {
  return page.evaluate((n) => (window as unknown as { __smMeasures: Array<{ name: string; duration: number }> }).__smMeasures.filter((e) => e.name === n).map((e) => Number(e.duration.toFixed(1))), name);
}

interface CardBox { name: string; scrollHeight: number; clientHeight: number }
/** R2: every option card in the map, with its content height against its box (a card overflows when content > box). */
function cardBoxes(page: Page): Promise<CardBox[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('section[aria-label="Sourcing map"] article')).map((a) => ({
      name: a.querySelector('button[data-anchor]')?.getAttribute('data-anchor') ?? '?',
      scrollHeight: a.scrollHeight,
      clientHeight: a.clientHeight,
    })),
  );
}
const overflowing = (cards: CardBox[]) => cards.filter((c) => c.scrollHeight > c.clientHeight + 1);

interface GapLabel {
  status: string | null; text: string | null;
  /** the label's box in the trace svg's coordinates, and the svg's size */
  box: { x: number; y: number; w: number; h: number }; svg: { w: number; h: number };
  clipped: boolean;
  /** the option cards (by anchor) other than the traced card that the label's box intersects */
  overpaints: string[];
}
/** R3: each gap stub's label, whether the svg clips it, and which other cards it paints over (a strict intersection). */
function gapLabels(page: Page, tracedKey: string): Promise<GapLabel[]> {
  return page.evaluate((traced) => {
    const svg = document.querySelector('svg[data-trace]')!;
    const s = svg.getBoundingClientRect();
    const own = document.querySelector(`[data-anchor="${traced}"]`)!.closest('article');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('section[aria-label="Sourcing map"] article')).filter((a) => a !== own);
    const hits = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
    return Array.from(svg.querySelectorAll<SVGGElement>('g[data-trace-gap]')).flatMap((g) => {
      const t = g.querySelector('text');
      if (!t) return [];
      const r = t.getBoundingClientRect();
      return [{
        status: g.getAttribute('data-status'),
        text: t.textContent,
        box: { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height },
        svg: { w: s.width, h: s.height },
        clipped: r.left < s.left || r.top < s.top || r.right > s.right || r.bottom > s.bottom,
        overpaints: cards.filter((a) => hits(r, a.getBoundingClientRect())).map((a) => a.querySelector('button[data-anchor]')?.getAttribute('data-anchor') ?? '?'),
      }];
    });
  }, tracedKey);
}

test.describe('Sourcing Map SP2 harness (fixtures, real browser)', () => {
  test.skip(!HARNESS, 'Needs SM_HARNESS_URL: a worktree dev server started with SM_HARNESS=1 (plan Task 13 Step 6)');

  test('multitier: map render < 200 ms, trace draw < 100 ms, real trace geometry, no card overflow, gap labels clear, axe clean with a trace selected in both themes (spec §12.6, R-9)', async ({ page }) => {
    await routeBff(page);
    await observeMeasures(page);
    await page.goto(`${HARNESS}/sm-harness/multitier`);
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible();
    await expect(page.getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeVisible();
    const renderMs = await durations(page, 'sm-map-render');
    console.log(`SM_SP2_MAP_RENDER_MS browser=${JSON.stringify(renderMs)}`);
    // G-2: the estimate line's may-wait came through the routed BFF
    await expect(page.getByText('; Arno Pelli may need to wait')).toBeVisible();
    // Setup, not a measurement: the anchors are measured once per selection, so the web fonts settle first.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    await page.getByRole('button', { name: 'A · tier 2 — binding for León Cuero' }).click();
    const overlay = page.getByRole('img', { name: /^Shortfall trace: León Cuero/ });
    await expect(overlay).toBeVisible();
    const traceMs = await durations(page, 'sm-trace-draw');
    console.log(`SM_SP2_TRACE_DRAW_MS browser=${JSON.stringify(traceMs)}`);

    // real geometry: the edge leaves the León header's left-mid and enters its A handle's left-mid, in the frame's frame
    const g = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-trace]')!;
      const frame = svg.parentElement!.getBoundingClientRect();
      const rel = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left - frame.left, y: r.top - frame.top, w: r.width, h: r.height }; };
      return {
        header: rel(document.querySelector('[data-anchor="leon"]')!),
        handle: rel(document.querySelector('[data-anchor="leon/A"]')!),
        d: svg.querySelector('path[data-trace-edge]')!.getAttribute('d')!,
        gap: svg.querySelector('g[data-trace-gap] text')!.textContent,
      };
    });

    // R3: with León's trace selected, its gap label is inside the svg and paints over no other card
    const labels = await gapLabels(page, 'leon');
    console.log(`SM_SP2_GAP_LABELS=${JSON.stringify(labels)}`);

    // R2 and axe, dark (the default), then light; León stays selected (its 2 px border is the tightest box)
    const cardsDark = await cardBoxes(page);
    const dark = await axe(page);
    console.log(`SM_SP2_AXE dark=${axeLine(dark)}`);
    await page.getByRole('button', { name: 'Light theme' }).click();
    await expect(page.getByTestId('sm-root')).toHaveAttribute('data-theme', 'light');
    const cardsLight = await cardBoxes(page);
    const light = await axe(page);
    console.log(`SM_SP2_AXE light=${axeLine(light)}`);
    console.log(`SM_SP2_CARD_OVERFLOW dark=${JSON.stringify(overflowing(cardsDark))} light=${JSON.stringify(overflowing(cardsLight))}`);
    console.log(`SM_SP2_MEASURES_ALL (information) map=${JSON.stringify(await observed(page, 'sm-map-render'))} trace=${JSON.stringify(await observed(page, 'sm-trace-draw'))}`);

    // Every measurement is logged above before any of these fails, so one defect never hides another.
    expect(renderMs.length).toBeGreaterThan(0);
    expect(Math.max(...renderMs)).toBeLessThan(200);
    expect(traceMs.length).toBeGreaterThan(0);
    expect(Math.max(...traceMs)).toBeLessThan(100);
    const nums = (g.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(nums).toHaveLength(8);
    expect(nums[0]).toBeCloseTo(g.header.x, 0);
    expect(nums[1]).toBeCloseTo(g.header.y + g.header.h / 2, 0);
    expect(nums[6]).toBeCloseTo(g.handle.x, 0);
    expect(nums[7]).toBeCloseTo(g.handle.y + g.handle.h / 2, 0);
    expect(g.handle.y).toBeGreaterThan(g.header.y + g.header.h);
    expect(g.gap).toBe('not observed below: not connected');
    expect(labels).toHaveLength(1);
    expect(labels.map((l) => ({ text: l.text, clipped: l.clipped, overpaints: l.overpaints }))).toEqual([
      { text: 'not observed below: not connected', clipped: false, overpaints: [] },
    ]);
    expect(cardsDark).toHaveLength(MULTITIER_CARDS);
    expect(cardsLight).toHaveLength(MULTITIER_CARDS);
    expect(overflowing(cardsDark)).toEqual([]);
    expect(overflowing(cardsLight)).toEqual([]);
    expect(dark).toEqual([]);
    expect(light).toEqual([]);

    // the handle panel from the traced card's handle; deselecting clears the path (spec §12.3)
    await page.getByRole('group', { name: 'Tier 2 under León Cuero' }).getByRole('button', { name: /^A · IT · Dyes/ }).click();
    const panel = page.getByRole('complementary', { name: 'Details for supplier A' });
    await expect(panel.getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeVisible();
    await expect(panel.getByText('Also supplies: Mekong Tannery')).toBeVisible();
    await panel.getByRole('button', { name: 'Close handle details' }).click();
    await page.getByRole('complementary', { name: 'Details for León Cuero' }).getByRole('button', { name: 'Close details' }).click();
    await expect(overlay).toHaveCount(0);
  });

  test('throttled: the wait sentence names the responder and the hour once the poll answers; Cancel stays live; the waiting card says so', async ({ page }) => {
    await routeBff(page);
    await page.goto(`${HARNESS}/sm-harness/throttled`);
    await expect(page.getByRole('status')).toHaveText("Waiting for Arno Pelli's hourly allowance until 11:00 UTC — the run continues on its own.");
    await expect(page.getByRole('button', { name: 'Cancel execution' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arno Pelli, IT: Waiting · hourly allowance' })).toBeVisible();
  });
});
