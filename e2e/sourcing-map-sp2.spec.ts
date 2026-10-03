import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { login } from './sourcing-map-login';
import { axe, axeLine, cardBoxes, durations, overflowing } from './sourcing-map-harness';

/**
 * Sourcing Map SP2 (spec §12.6): the run workspace on the SP2-0 fixtures in a real browser, through the dev-only
 * harness route /sm-harness/<fixture> (served only by a server started with SM_HARNESS=1; plan Task 13). Measures
 * the map render (R-9, < 200 ms) and the trace draw (< 100 ms), checks the trace's real geometry, and runs axe with
 * a trace selected in both themes. Also measures what jsdom cannot lay out (Task 13 rulings R2, R3): no option card
 * overflows its box in either theme, and a gap stub's label neither paints over another card nor is clipped; and
 * (fix round) every tier-row handle is one line inside its card, and gap labels never overlap one another.
 * Skips — never throws — without SM_HARNESS_URL (e.g. http://localhost:3111).
 * The live-seed walk (Task 14) is the second describe below.
 */
const HARNESS = process.env.SM_HARNESS_URL;
const FIXTURES = path.join(process.cwd(), 'src/app/sourcing-map/__fixtures__/sp2');
const estimate = JSON.parse(readFileSync(path.join(FIXTURES, 'estimate-may-wait.json'), 'utf8')) as unknown;
const throttled = JSON.parse(readFileSync(path.join(FIXTURES, 'execution-throttled.json'), 'utf8')) as { status: unknown };
/** The multitier fixture's option cards: leather (León, Mekong, Arno's timeout), knit uppers, laces, outsoles. */
const MULTITIER_CARDS = 6;
/** Its tier-row handles: León A B C, Mekong A F C, FlowKnit D, Bowline D, Zephyr E. */
const MULTITIER_HANDLES = 9;
/** A tier row's height (MAP_L.tierRowH); a handle is one line inside it. */
const TIER_ROW_H = 26;

async function routeBff(page: Page): Promise<void> {
  await page.route('**/api/account/sourcing-map/runs/*/estimate', (route) => route.fulfill({ json: estimate }));
  await page.route('**/api/account/sourcing-map/executions/*/status**', (route) => route.fulfill({ json: throttled.status }));
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

interface HandleBox { anchor: string; height: number; scrollHeight: number; clientHeight: number; inCard: boolean }
/**
 * Task 13 fix round A: every tier-row handle, its height, whether it lies inside its option card (±1 px), and whether
 * its content fits its box. The handle's box has a fixed height, so a label wrapped onto two lines shows as content
 * taller than the box (scrollHeight), not as a taller box.
 */
function handleBoxes(page: Page): Promise<HandleBox[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('section[aria-label="Sourcing map"] article button[data-alias]')).map((h) => {
      const r = h.getBoundingClientRect();
      const c = h.closest('article')!.getBoundingClientRect();
      return {
        anchor: h.dataset.anchor ?? '?',
        height: r.height,
        scrollHeight: h.scrollHeight,
        clientHeight: h.clientHeight,
        inCard: r.left >= c.left - 1 && r.top >= c.top - 1 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1,
      };
    }),
  );
}
const badHandles = (hs: HandleBox[]) => hs.filter((h) => h.height > TIER_ROW_H || !h.inCard || h.scrollHeight > h.clientHeight + 1);

interface GapLabel {
  status: string | null; text: string | null;
  /** the label's box in the trace svg's coordinates, and the svg's size */
  box: { x: number; y: number; w: number; h: number }; svg: { w: number; h: number };
  clipped: boolean;
  /** the option cards (by anchor) other than the traced card that the label's box intersects */
  overpaints: string[];
  /** the other gap labels (by index) whose box this label's box intersects (fix round B: several on one anchor stack) */
  overlapsLabels: number[];
}
/** R3: each gap stub's label, whether the svg clips it, and which other cards it paints over (a strict intersection). */
function gapLabels(page: Page, tracedKey: string): Promise<GapLabel[]> {
  return page.evaluate((traced) => {
    const svg = document.querySelector('svg[data-trace]')!;
    const s = svg.getBoundingClientRect();
    const own = document.querySelector(`[data-anchor="${traced}"]`)!.closest('article');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('section[aria-label="Sourcing map"] article')).filter((a) => a !== own);
    const hits = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
    const texts = Array.from(svg.querySelectorAll<SVGTextElement>('g[data-trace-gap] text'));
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
        overlapsLabels: texts.flatMap((o, i) => (o !== t && hits(r, o.getBoundingClientRect()) ? [i] : [])),
      }];
    });
  }, tracedKey);
}

/** F-2: the trace svg's labels whose box intersects the traced card's class-path subtitle (the line under its header). */
function labelsOverSubtitle(page: Page, tracedKey: string): Promise<string[]> {
  return page.evaluate((traced) => {
    const sub = document.querySelector(`[data-anchor="${traced}"]`)!.nextElementSibling!.getBoundingClientRect();
    const hits = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
    return Array.from(document.querySelectorAll<SVGTextElement>('svg[data-trace] text')).filter((t) => hits(t.getBoundingClientRect(), sub)).map((t) => t.textContent ?? '');
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
        gap: (() => {
          const gp = svg.querySelector('g[data-trace-gap]')!;
          return { status: gp.getAttribute('data-status'), dash: gp.querySelector('path')?.getAttribute('stroke-dasharray') ?? null, texts: gp.querySelectorAll('text').length, backs: gp.querySelectorAll('rect').length };
        })(),
      };
    });

    // R3: with León's trace selected, no gap label is clipped or paints over another card. León's one gap is the card's
    // own, so it draws its stub only (F-2): a label there sat on the class-path subtitle
    const labels = await gapLabels(page, 'leon');
    console.log(`SM_SP2_GAP_LABELS=${JSON.stringify(labels)}`);
    const overSubtitleDark = await labelsOverSubtitle(page, 'leon');

    // R2 and axe, dark (the default), then light; León stays selected (its 2 px border is the tightest box)
    const cardsDark = await cardBoxes(page);
    const handlesDark = await handleBoxes(page);
    const dark = await axe(page);
    console.log(`SM_SP2_AXE dark=${axeLine(dark)}`);
    await page.getByRole('button', { name: 'Light theme' }).click();
    await expect(page.getByTestId('sm-root')).toHaveAttribute('data-theme', 'light');
    const cardsLight = await cardBoxes(page);
    const handlesLight = await handleBoxes(page);
    const overSubtitleLight = await labelsOverSubtitle(page, 'leon');
    const light = await axe(page);
    console.log(`SM_SP2_AXE light=${axeLine(light)}`);
    console.log(`SM_SP2_CARD_OVERFLOW dark=${JSON.stringify(overflowing(cardsDark))} light=${JSON.stringify(overflowing(cardsLight))}`);
    console.log(`SM_SP2_LABELS_OVER_SUBTITLE dark=${JSON.stringify(overSubtitleDark)} light=${JSON.stringify(overSubtitleLight)}`);
    console.log(`SM_SP2_HANDLES dark=${JSON.stringify(badHandles(handlesDark))} light=${JSON.stringify(badHandles(handlesLight))}`);
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
    expect(g.gap).toEqual({ status: 'not_connected', dash: '4 4', texts: 0, backs: 0 });
    expect(labels).toEqual([]);
    expect(overSubtitleDark).toEqual([]);
    expect(overSubtitleLight).toEqual([]);
    expect(cardsDark).toHaveLength(MULTITIER_CARDS);
    expect(cardsLight).toHaveLength(MULTITIER_CARDS);
    expect(overflowing(cardsDark)).toEqual([]);
    expect(overflowing(cardsLight)).toEqual([]);
    expect(handlesDark).toHaveLength(MULTITIER_HANDLES);
    expect(handlesLight).toHaveLength(MULTITIER_HANDLES);
    expect(badHandles(handlesDark)).toEqual([]);
    expect(badHandles(handlesLight)).toEqual([]);
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

test.describe('Sourcing Map SP2 walk (CSG, live seed — SP2-e, on the owner’s word)', () => {
  const HAIWEB = process.env.HAIWEB_BASE_URL ?? 'http://localhost:3001';
  const EMAIL = process.env.SM_CSG_EMAIL;
  const PASSWORD = process.env.SM_CSG_PASSWORD;
  const RUN_PATH = process.env.SM_SP2_RUN_PATH;
  test.skip(process.env.SM_SP2_LIVE !== '1' || !EMAIL || !PASSWORD || !RUN_PATH, 'Needs SM_SP2_LIVE=1, SM_CSG_EMAIL, SM_CSG_PASSWORD and SM_SP2_RUN_PATH; runs only in the SP2-e walk');

  test('Line A base: León reads the tier-2 reason and traces to a binding alias shared with Mekong; Zephyr reads own capacity; a tier 3 sits under León; nothing below tier 1 is named or counted; the handle panel closes back to its handle (spec §14.1–3, §14.7, §14.9)', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    await login(page, EMAIL!, PASSWORD!);
    await page.goto(`${HAIWEB}${RUN_PATH}`);
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeVisible();
    console.log(`SM_SP2_MAP_RENDER_MS live=${JSON.stringify(await durations(page, 'sm-map-render'))}`);

    // §14.1: León short with the tier-2 reason; the limits list names one binding node for it
    await expect(page.getByRole('button', { name: /^León Cuero, MX: .*Limit: constraint returned by current source, tier 2/ })).toBeVisible();
    const limit = page.getByRole('region', { name: 'Supply-chain limits' }).getByRole('button', { name: /^[A-Z]{1,4} · tier 2 — binding for León Cuero$/ });
    await expect(limit).toHaveCount(1);
    await limit.click();
    const overlay = page.getByRole('img', { name: /^Shortfall trace: León Cuero → [A-Z]{1,4} \((slight|moderate|severe)\); binding: [A-Z]{1,4} \(tier 2\)/ });
    await expect(overlay).toBeVisible();
    console.log(`SM_SP2_TRACE_DRAW_MS live=${JSON.stringify(await durations(page, 'sm-trace-draw'))}`);
    const alias = (await overlay.getAttribute('aria-label'))!.match(/binding: ([A-Z]{1,4}) \(tier 2\)/)![1]!;
    // §14.1: Shared exposure lists one tier-2 alias under León and Mekong
    const shared = page.getByRole('region', { name: 'Shared exposure' }).getByRole('listitem').filter({ hasText: /^[A-Z]{1,4} · tier 2 — León Cuero, Mekong Tannery$/ });
    await expect(shared).toHaveCount(1);
    // the binding alias sits under Mekong too (shared exposure), marked binding only under León
    const leonHandle = page.getByRole('group', { name: 'Tier 2 under León Cuero' }).getByRole('button', { name: new RegExp(`^${alias} · `) });
    const mekongHandle = page.getByRole('group', { name: 'Tier 2 under Mekong Tannery' }).getByRole('button', { name: new RegExp(`^${alias} · `) });
    await expect(leonHandle).toBeVisible();
    await expect(mekongHandle).toBeVisible();
    await expect(leonHandle.getByRole('img', { name: 'binding' })).toBeVisible();
    await expect(mekongHandle.getByRole('img', { name: 'binding' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mekong Tannery, VN: .*No shortfall stated/ })).toBeVisible();
    // §14.2: Zephyr's own limit, with a tier-2 handle beneath
    await expect(page.getByRole('button', { name: /^Zephyr Compounds, DE: .*Limit: own capacity/ })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Tier 2 under Zephyr Compounds' }).getByRole('button')).toHaveCount(1);
    // §14.3: a tier-3 handle under León
    await expect(page.getByRole('group', { name: 'Tier 3 under León Cuero' }).getByRole('button')).toHaveCount(1);
    // §14.7: the shared yarn node under FlowKnit and Bowline, no band
    for (const name of ['FlowKnit Mills', 'Bowline Trim']) {
      const handles = page.getByRole('group', { name: `Tier 2 under ${name}` }).getByRole('button');
      await expect(handles).toHaveCount(1);
      await expect(handles.first().getByRole('img')).toHaveCount(0);
    }
    // requirements §7.3 on the page: every handle is alias · country · class, no digits run and none of the reset script's names.
    // The handles are found inside the tier-row groups: a card header's anchor is its candidate_key, whose SKU may hold a "/".
    const handleTexts = await page.getByRole('group', { name: /^Tier \d+ under / }).locator('button[data-alias]').allTextContents();
    expect(handleTexts.length).toBeGreaterThan(0);
    for (const t of handleTexts) expect(t).toMatch(/^[A-Z]{1,4} · (—|[A-Z]{2}) · [^0-9]*$/);
    const body = await page.locator('[data-testid="sm-root"]').innerText();
    expect(body).not.toMatch(/Vetta|Halcyon|Rio Bravo|Delta Hides|Chroma|Songkhla|Pacific Yarn|Sierra Tanning/);
    // the handle panel says so too
    await leonHandle.click();
    const panel = page.getByRole('complementary', { name: `Details for supplier ${alias}` });
    await expect(panel.getByText('Identity, quantities and names below tier 1 are not disclosed.')).toBeVisible();
    await expect(panel.getByText('Also supplies: Mekong Tannery')).toBeVisible();
    // Close returns focus to the handle (on the real candidate_key, whose quotes a CSS selector could not carry: C-1)
    await panel.getByRole('button', { name: 'Close handle details' }).click();
    await expect(panel).toHaveCount(0);
    await expect(leonHandle).toBeFocused();
  });
});
