import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { axe, axeLine, cardBoxes, durations, overflowing } from './sourcing-map-harness';

/**
 * Sourcing Map LF (spec §9.3, §9.4): what only a browser can show about the deferred features, through the dev-only
 * harness route /sm-harness/<fixture> (served only by a server started with SM_HARNESS=1): two traces' geometry, the
 * R-9 budgets with two traces drawn, axe in five states and both themes, Escape and focus with real key presses, the
 * result picker, the heat switch, the handle count and the direct supplier's p90 (H-8). Each test logs its SM_LF_* lines before it asserts, so one
 * defect never hides another. Skips, never throws, without SM_HARNESS_URL (e.g. http://localhost:3111).
 * SM_LF_SHOTS=<folder> also saves one screenshot per state and theme of H-3 (ruling F29).
 */
const HARNESS = process.env.SM_HARNESS_URL;
const SHOTS = process.env.SM_LF_SHOTS;
const FIXTURES = path.join(process.cwd(), 'src/app/sourcing-map/__fixtures__');
const estimate = JSON.parse(readFileSync(path.join(FIXTURES, 'sp2/estimate-may-wait.json'), 'utf8')) as unknown;
const throttled = JSON.parse(readFileSync(path.join(FIXTURES, 'sp2/execution-throttled.json'), 'utf8')) as { status: unknown };
const panelLeon = JSON.parse(readFileSync(path.join(FIXTURES, 'sp3/option-panel-leon.json'), 'utf8')) as unknown;
const panelP90 = JSON.parse(readFileSync(path.join(FIXTURES, 'lf/option-panel-p90.json'), 'utf8')) as unknown;
/** The compare fixture's (the multitier's deep copy with deltas) option cards: leather (León, Mekong, Arno's timeout), knit uppers, laces, outsoles. */
const CARDS = 6;
/** Its tier-row handles (compare): León A B C, Mekong A F C, FlowKnit D, Bowline D, Zephyr E. */
const HANDLES = 9;

// The three items below (TIER_ROW_H, handleBoxes, badHandles) are copies of e2e/sourcing-map-sp2.spec.ts:26 and :50-71 (ruling F23): the existing specs are the
// regression guard of two shipped lanes and stay as they are, so the helpers are copied, not hoisted (a backlog line).
/** A tier row's height (MAP_L.tierRowH); a handle is one line inside it. */
const TIER_ROW_H = 26;
interface HandleBox { anchor: string; height: number; scrollHeight: number; clientHeight: number; inCard: boolean }
/** Every tier-row handle, its height, whether it lies inside its option card (±1 px), and whether its content fits its box. */
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

/** The BFF forms of sourcing-map-sp2.spec.ts:28-31 and sourcing-map-sp3.spec.ts:18-20, written again (they are not exported). */
async function routeBff(page: Page, panel: unknown): Promise<void> {
  await page.route('**/api/account/sourcing-map/runs/*/estimate', (route) => route.fulfill({ json: estimate }));
  await page.route('**/api/account/sourcing-map/executions/*/status**', (route) => route.fulfill({ json: throttled.status }));
  await page.route('**/options/*/panel', (route) => route.fulfill({ json: panel }));
}

/**
 * Measures as they are made, from before the page's scripts: each commit clears the previous measure, so the timeline
 * alone holds only the latest. H-2 asserts on the timeline (the last commit's measure, in the state under test); this
 * list is information only, logged beside it.
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

const fontsSettled = (page: Page) => page.evaluate(() => document.fonts.ready.then(() => undefined));
const root = (page: Page) => page.getByTestId('sm-root');
const cardButton = (page: Page, key: string) => page.locator(`section[aria-label="Sourcing map"] button[data-anchor="${key}"]`);
const details = (page: Page, name: string) => page.getByRole('complementary', { name: `Details for ${name}` });

async function openPage(page: Page, fixture: 'compare' | 'throttled' | 'multitier', panel: unknown = panelLeon): Promise<void> {
  await routeBff(page, panel);
  await page.goto(`${HARNESS}/sm-harness/${fixture}`);
  await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible();
  // Setup, not a measurement: the anchors are measured once per selection, so the web fonts settle first.
  await fontsSettled(page);
}
/** Pin FlowKnit, then select Bowline: two traced cards that both end at their own D. */
async function pinFlowKnitSelectBowline(page: Page): Promise<void> {
  await cardButton(page, 'flowknit').click();
  await details(page, 'FlowKnit Mills').getByRole('button', { name: 'Pin', exact: true }).click();
  await cardButton(page, 'bowline').click();
  await expect(page.getByRole('img', { name: /^Shortfall trace \(pinned\): / })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Shortfall trace: / })).toBeVisible();
}
async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  if ((await root(page).getAttribute('data-theme')) !== theme) await page.getByRole('button', { name: theme === 'light' ? 'Light theme' : 'Dark theme' }).click();
  await expect(root(page)).toHaveAttribute('data-theme', theme);
}

interface Box { x: number; y: number; w: number; h: number }
interface TraceGeometry { pinned: boolean; label: string; edges: number; d: string; card: Box; header: Box; handle: Box; gutter: number }
/**
 * Each overlay's first edge with the geometry of the card it belongs to, in the trace frame's coordinates: the card
 * (its article), its header button and the `<key>/D` handle. The overlay's own card is the one named by its aria-label.
 */
function traceGeometry(page: Page, cards: Array<{ pinned: boolean; key: string }>): Promise<TraceGeometry[]> {
  return page.evaluate((specs) => {
    const svgs = Array.from(document.querySelectorAll<SVGSVGElement>('svg[data-trace]'));
    return specs.map((s) => {
      const svg = svgs.find((v) => (v.getAttribute('aria-label') ?? '').startsWith(s.pinned ? 'Shortfall trace (pinned):' : 'Shortfall trace:'))!;
      const frame = svg.parentElement!.getBoundingClientRect();
      const rel = (el: Element): { x: number; y: number; w: number; h: number } => { const r = el.getBoundingClientRect(); return { x: r.left - frame.left, y: r.top - frame.top, w: r.width, h: r.height }; };
      const header = document.querySelector(`button[data-anchor="${s.key}"]`)!;
      return {
        pinned: s.pinned,
        label: svg.getAttribute('aria-label') ?? '',
        edges: svg.querySelectorAll('path[data-trace-edge]').length,
        d: svg.querySelector('path[data-trace-edge]')!.getAttribute('d')!,
        card: rel(header.closest('article')!),
        header: rel(header),
        handle: rel(document.querySelector(`button[data-anchor="${s.key}/D"]`)!),
        gutter: 16,
      };
    });
  }, cards);
}

test.describe('Sourcing Map LF harness (fixtures, real browser)', () => {
  test.skip(!HARNESS, 'Needs SM_HARNESS_URL: a worktree dev server started with SM_HARNESS=1');

  test('H-1 two traces: each edge leaves its own card and enters its own D; every card and handle fits, in both themes, with a Pinned card on screen', async ({ page }) => {
    await openPage(page, 'compare');
    await pinFlowKnitSelectBowline(page);
    const overlays = await page.locator('svg[data-trace]').count();
    const pinnedMarks = await page.getByText('Pinned', { exact: true }).count();
    const geo = await traceGeometry(page, [{ pinned: true, key: 'flowknit' }, { pinned: false, key: 'bowline' }]);
    const dark = { cards: await cardBoxes(page), handles: await handleBoxes(page) };
    await setTheme(page, 'light');
    const light = { cards: await cardBoxes(page), handles: await handleBoxes(page) };
    console.log(`SM_LF_TRACES overlays=${overlays} pinned_marks=${pinnedMarks} geometry=${JSON.stringify(geo)}`);
    console.log(`SM_LF_CARD_OVERFLOW dark=${JSON.stringify(overflowing(dark.cards))} light=${JSON.stringify(overflowing(light.cards))}`);
    console.log(`SM_LF_HANDLES count dark=${dark.handles.length} light=${light.handles.length} bad dark=${JSON.stringify(badHandles(dark.handles))} light=${JSON.stringify(badHandles(light.handles))}`);

    // each overlay's first edge: from its own card's header (left-mid) to its own <key>/D handle (left-mid), to 0.5 px as
    // sourcing-map-sp2.spec.ts:184-190 checks one, and the edge's x-extent inside its own card and that card's left gutter
    const edges = geo.map((g) => {
      const n = (g.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      const xs = [n[0]!, n[2]!, n[4]!, n[6]!];
      const ys = [n[1]!, n[3]!, n[5]!, n[7]!];
      const off = (a: number, b: number) => Math.abs(a - b) < 0.5;
      return {
        count: g.edges, numbers: n.length,
        leavesOwnHeader: off(n[0]!, g.header.x) && off(n[1]!, g.header.y + g.header.h / 2),
        entersOwnHandle: off(n[6]!, g.handle.x) && off(n[7]!, g.handle.y + g.handle.h / 2),
        insideOwnCardX: Math.min(...xs) >= g.card.x - g.gutter && Math.max(...xs) <= g.card.x + g.card.w,
        insideOwnCardY: Math.min(...ys) >= g.card.y && Math.max(...ys) <= g.card.y + g.card.h,
      };
    });
    const each = <T,>(want: T) => geo.map(() => want);
    expect.soft({ overlays, pinnedMarks }).toEqual({ overlays: 2, pinnedMarks: 1 });
    expect.soft(edges.map((e) => [e.count, e.numbers]), 'one edge of 8 numbers per overlay').toEqual(each([1, 8]));
    expect.soft(edges.map((e) => e.leavesOwnHeader), 'each edge leaves its own header at left-mid').toEqual(each(true));
    expect.soft(edges.map((e) => e.entersOwnHandle), 'each edge enters its own D at left-mid').toEqual(each(true));
    expect.soft(edges.map((e) => e.insideOwnCardX), 'x-extent inside the card and its left gutter').toEqual(each(true));
    expect.soft(edges.map((e) => e.insideOwnCardY), 'y-extent inside its own card').toEqual(each(true));
    expect.soft({ cards: [dark.cards.length, light.cards.length], handles: [dark.handles.length, light.handles.length] }).toEqual({ cards: [CARDS, CARDS], handles: [HANDLES, HANDLES] });
    expect.soft({ dark: { cards: overflowing(dark.cards), handles: badHandles(dark.handles) }, light: { cards: overflowing(light.cards), handles: badHandles(light.handles) } })
      .toEqual({ dark: { cards: [], handles: [] }, light: { cards: [], handles: [] } });
  });

  test('H-2 R-9: with two traces and the strip on screen, the map renders under 200 ms, the traces draw under 100 ms, the panel opens under 200 ms', async ({ page }) => {
    await observeMeasures(page);
    await openPage(page, 'compare');
    await pinFlowKnitSelectBowline(page);
    // the panel's own measure ends when its fetch answers, with the strip and the tabs on screen
    await expect(details(page, 'Bowline Trim').getByText('Calibrated median: 42 d (4 orders)')).toBeVisible();
    const present = await page.locator('table[aria-label="Compare pinned and active"], [role="tablist"][aria-label="Option details"]').count();
    const renderMs = await durations(page, 'sm-map-render');
    const traceMs = await durations(page, 'sm-trace-draw');
    const panelMs = await durations(page, 'sm-panel-open');
    console.log(`SM_LF_MAP_RENDER_MS browser=${JSON.stringify(renderMs)}`);
    console.log(`SM_LF_TRACE_DRAW_MS browser=${JSON.stringify(traceMs)}`);
    console.log(`SM_LF_PANEL_OPEN_MS browser=${JSON.stringify(panelMs)}`);
    console.log(`SM_LF_MEASURES_ALL (information) map=${JSON.stringify(await observed(page, 'sm-map-render'))} trace=${JSON.stringify(await observed(page, 'sm-trace-draw'))} panel=${JSON.stringify(await observed(page, 'sm-panel-open'))}`);

    expect(present).toBe(2);
    expect(renderMs.length).toBeGreaterThan(0);
    expect(Math.max(...renderMs)).toBeLessThan(200);
    expect(traceMs.length).toBeGreaterThan(0);
    expect(Math.max(...traceMs)).toBeLessThan(100);
    expect(panelMs.length).toBeGreaterThan(0);
    expect(Math.max(...panelMs)).toBeLessThan(200);
  });

  test('H-3 axe: clean in dark and light in five states, each with a screenshot: two traces and the strip, Path beneath, the handle panel, heat off, the unavailable controls', async ({ page }) => {
    const states: Record<string, { present: boolean; dark: string; light: string }> = {};
    /** Both themes of the state on screen: a screenshot each (SM_LF_SHOTS), and axe over the app's root. */
    async function scan(state: string, present: () => Promise<boolean>): Promise<void> {
      const result = { present: false, dark: '', light: '' };
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `h3-${state}-${theme}.png`), fullPage: true });
        result.present = theme === 'dark' ? await present() : result.present && (await present());
        result[theme] = axeLine(await axe(page));
      }
      states[state] = result;
      console.log(`SM_LF_AXE state=${state} present=${result.present} dark=${result.dark} light=${result.light}`);
    }
    const visible = async (...locators: Array<ReturnType<Page['locator']>>) => (await Promise.all(locators.map((l) => l.first().isVisible()))).every(Boolean);

    // (a) compare: two traces with the strip
    await openPage(page, 'compare');
    await pinFlowKnitSelectBowline(page);
    const strip = page.getByRole('table', { name: 'Compare pinned and active' });
    await scan('a-strip', () => visible(strip, strip.getByRole('cell', { name: 'D', exact: true })));

    // (b) compare: León's Path beneath tab open
    await openPage(page, 'compare');
    await cardButton(page, 'leon').click();
    await details(page, 'León Cuero').getByRole('tab', { name: 'Path beneath' }).click();
    const rows = details(page, 'León Cuero').locator('button[data-path-row]');
    await scan('b-path-beneath', async () => (await rows.count()) === 3 && (await visible(rows.nth(0), rows.nth(2), details(page, 'León Cuero').getByText('also under 1'))));

    // (c) compare: the handle panel for C under León
    await rows.filter({ hasText: /^C · / }).click();
    const handlePanel = page.getByRole('complementary', { name: 'Details for supplier C' });
    await scan('c-handle-panel', () => visible(handlePanel.getByText('Also at tier 2 under Mekong Tannery')));

    // (d) compare: heat off
    await openPage(page, 'compare');
    await page.getByRole('button', { name: 'Heat on links: on' }).click();
    await scan('d-heat-off', () => visible(page.getByRole('button', { name: 'Heat on links: off' })));
    await page.evaluate(() => window.localStorage.removeItem('sm.heat'));

    // (e) throttled: León's details open, the four controls unavailable, each with its reason
    await openPage(page, 'throttled');
    await cardButton(page, 'leon').click();
    const panel = details(page, 'León Cuero');
    await expect(panel).toBeVisible();
    const four = [panel.getByRole('button', { name: 'Pin', exact: true }), panel.getByRole('tab', { name: 'Path beneath' }), page.getByRole('button', { name: 'Hide all paths' }), page.getByRole('button', { name: /^Heat on links/ })];
    await scan('e-unavailable', async () => (await Promise.all(four.map((l) => l.getAttribute('aria-disabled')))).every((v) => v === 'true') && (await visible(page.getByText('Available when the run completes.').first())));

    expect.soft(states['a-strip'], 'a-strip').toEqual({ present: true, dark: '[]', light: '[]' });
    expect.soft(states['b-path-beneath'], 'b-path-beneath').toEqual({ present: true, dark: '[]', light: '[]' });
    expect.soft(states['c-handle-panel'], 'c-handle-panel').toEqual({ present: true, dark: '[]', light: '[]' });
    expect.soft(states['d-heat-off'], 'd-heat-off').toEqual({ present: true, dark: '[]', light: '[]' });
    expect.soft(states['e-unavailable'], 'e-unavailable').toEqual({ present: true, dark: '[]', light: '[]' });
  });

  test('H-4 Escape and focus: one layer per real key press, and focus lands on the opener, never <body>', async ({ page }) => {
    /** What holds focus: the tag with the path row, the card's anchor, or the button's text; "BODY|" when nothing does. */
    const active = () => page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (e === null || e === document.body) return 'BODY|';
      return `${e.tagName}|${e.dataset.pathRow ?? e.dataset.anchor ?? (e.textContent ?? '').trim()}`;
    });
    const frames = () => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const press = async (key: string) => { await page.keyboard.press(key); await frames(); };
    const leon = details(page, 'León Cuero');
    const handleAside = page.getByRole('complementary', { name: /^Details for supplier / });
    const openLeonRowA = async () => {
      await cardButton(page, 'leon').click();
      await leon.getByRole('tab', { name: 'Path beneath' }).click();
      await leon.locator('button[data-path-row="A"]').click();
      await expect(handleAside).toBeVisible();
    };
    await openPage(page, 'compare');
    // each segment starts from a fresh page, so a defect in one never leaves another with the wrong state to press on
    const fresh = async () => { await page.reload(); await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible(); await fontsSettled(page); };

    // León, Path beneath, row A: Escape closes the handle panel and row A is active; Escape again closes the details and León's card is active
    await openLeonRowA();
    await press('Escape');
    const afterHandle = { active: await active(), handlePanels: await handleAside.count(), detailsShown: await leon.isVisible() };
    await press('Escape');
    const afterDetails = { active: await active(), detailsPanels: await leon.count() };

    // Configure, Escape: the tray closes and Configure is active
    await fresh();
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByRole('dialog').or(page.getByRole('complementary', { name: /Configure/ })).first()).toBeVisible();
    await press('Escape');
    const afterTray = await active();

    // Pin León, close its details, Escape: no card says "Pinned"
    await fresh();
    await cardButton(page, 'leon').click();
    await leon.getByRole('button', { name: 'Pin', exact: true }).click();
    await leon.getByRole('button', { name: 'Close details' }).click();
    const pinnedBefore = await page.getByText('Pinned', { exact: true }).count();
    await press('Escape');
    const pinnedAfter = await page.getByText('Pinned', { exact: true }).count();

    // With focus INSIDE the handle panel, one Escape leaves the details showing
    await fresh();
    await openLeonRowA();
    const insideHandle = await handleAside.evaluate((a) => a.contains(document.activeElement));
    await press('Escape');
    const afterOne = { insideHandle, handlePanels: await handleAside.count(), detailsShown: await leon.isVisible() };

    // Unpin from the strip: pin León, select Mekong, press the strip's Unpin (a real click): Mekong's Pin button is active
    await fresh();
    await cardButton(page, 'leon').click();
    await leon.getByRole('button', { name: 'Pin', exact: true }).click();
    await cardButton(page, 'mekong').click();
    await page.getByRole('table', { name: 'Compare pinned and active' }).getByRole('button', { name: 'Unpin León Cuero' }).click();
    await frames();
    const afterUnpin = {
      mekongPinIsActive: await details(page, 'Mekong Tannery').getByRole('button', { name: 'Pin', exact: true }).evaluate((e) => e === document.activeElement),
      strips: await page.getByRole('table', { name: 'Compare pinned and active' }).count(),
    };

    console.log(`SM_LF_ESCAPE handle=${JSON.stringify(afterHandle)} details=${JSON.stringify(afterDetails)} tray=${afterTray} pinned=${pinnedBefore}->${pinnedAfter} one_press=${JSON.stringify(afterOne)}`);
    console.log(`SM_LF_FOCUS strip_unpin=${JSON.stringify(afterUnpin)}`);

    // Soft, so that one defect never hides another: each line reports on its own
    expect.soft(afterHandle, 'Escape from the handle panel: row A is active, the details stay').toEqual({ active: 'BUTTON|A', handlePanels: 0, detailsShown: true });
    expect.soft(afterDetails, 'Escape from the details: León card is active').toEqual({ active: 'BUTTON|leon', detailsPanels: 0 });
    expect.soft(afterTray, 'Escape from the Configure tray: Configure is active').toBe('BUTTON|Configure');
    expect.soft([pinnedBefore, pinnedAfter], 'Escape with only a pin left clears it').toEqual([1, 0]);
    expect.soft(afterOne, 'one Escape from inside the handle panel closes it alone').toEqual({ insideHandle: true, handlePanels: 0, detailsShown: true });
    expect.soft(afterUnpin, 'Unpin in the strip hands focus to Pin, never <body>').toEqual({ mekongPinIsActive: true, strips: 0 });
  });

  test('H-5 the picker: Escape on the open Result list does not close the details', async ({ page }) => {
    await openPage(page, 'compare');
    await cardButton(page, 'leon').click();
    const leon = details(page, 'León Cuero');
    await expect(leon).toBeVisible();
    const picker = page.getByRole('combobox', { name: 'Result' });
    await picker.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await page.keyboard.press('Escape');
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const shown = { detailsPanels: await leon.count(), detailsVisible: await leon.isVisible(), pickerFocused: await picker.evaluate((e) => e === document.activeElement) };
    console.log(`SM_LF_PICKER ${JSON.stringify(shown)}`);
    expect(shown).toEqual({ detailsPanels: 1, detailsVisible: true, pickerFocused: true });
  });

  test('H-6 heat: the switch makes every map link neutral and keeps the trace in its band colour; a reload keeps the choice', async ({ page }) => {
    await openPage(page, 'compare');
    await cardButton(page, 'leon').click();
    await expect(page.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeVisible();
    /** The links' computed strokes against the resolved --sm-line-2, and the trace edge against its own band colour */
    const links = () => page.evaluate(() => {
      const rootEl = document.querySelector('[data-testid="sm-root"]')!;
      const resolve = (value: string) => { const probe = document.createElement('span'); probe.style.color = value; rootEl.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; };
      const neutral = resolve('var(--sm-line-2)');
      const strokes = Array.from(document.querySelectorAll<SVGPathElement>('path[data-link]')).map((l) => getComputedStyle(l).stroke);
      const edge = document.querySelector<SVGPathElement>('path[data-trace-edge]')!;
      const edgeStroke = getComputedStyle(edge).stroke;
      return {
        links: strokes.length,
        coloured: strokes.filter((c) => c !== neutral).length,
        // the band's own token, named here and not read back from the edge's inline style
        edgeKeepsBand: edgeStroke === resolve(`var(--sm-heat-${({ slight: 'good', moderate: 'mid', severe: 'bad' } as Record<string, string>)[edge.dataset.band ?? '']})`) && edgeStroke !== neutral,
        label: Array.from(document.querySelectorAll('button')).map((b) => b.textContent ?? '').find((t) => t.startsWith('Heat on links')) ?? '',
      };
    });
    const before = await links();
    await page.getByRole('button', { name: 'Heat on links: on' }).click();
    await expect(page.getByRole('button', { name: 'Heat on links: off' })).toBeVisible();
    const pressed = await links();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible();
    await fontsSettled(page);
    await cardButton(page, 'leon').click();
    await expect(page.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeVisible();
    const reloaded = await links();
    console.log(`SM_LF_HEAT before=${JSON.stringify(before)} pressed=${JSON.stringify(pressed)} reloaded=${JSON.stringify(reloaded)}`);

    expect.soft(before.coloured, 'heat on: some links carry a heat colour').toBeGreaterThan(0);
    expect.soft({ label: pressed.label, links: pressed.links, coloured: pressed.coloured }, 'the press makes every link neutral').toEqual({ label: 'Heat on links: off', links: 14, coloured: 0 });
    expect.soft(pressed.edgeKeepsBand, 'the trace edge keeps its band colour with heat off').toBe(true);
    expect.soft({ label: reloaded.label, links: reloaded.links, coloured: reloaded.coloured }, 'after a reload the stored choice holds').toEqual({ label: 'Heat on links: off', links: 14, coloured: 0 });
  });

  test('H-7 handles: with León\'s Path beneath open there are still 9 map handles, and each reads alias · country · class with no digit', async ({ page }) => {
    await openPage(page, 'compare');
    await cardButton(page, 'leon').click();
    await details(page, 'León Cuero').getByRole('tab', { name: 'Path beneath' }).click();
    await expect(details(page, 'León Cuero').locator('button[data-path-row]').first()).toBeVisible();
    const handles = await root(page).locator('button[data-alias]').count();
    // the requirements §7.3 pattern of sourcing-map-sp2.spec.ts:275: alias · country · class, no digits run. The handles are found
    // inside the tier-row groups: a card header's anchor is its candidate_key, whose SKU may hold a "/".
    const texts = await page.getByRole('group', { name: /^Tier \d+ under / }).locator('button[data-alias]').allTextContents();
    const refused = texts.filter((t) => !/^[A-Z]{1,4} · (—|[A-Z]{2}) · [^0-9]*$/.test(t));
    console.log(`SM_LF_HANDLE_COUNT root=${handles} in_tier_groups=${texts.length} refused=${JSON.stringify(refused)}`);
    expect.soft(handles, 'every tier-row handle, and no Path beneath row, is a data-alias button').toBe(HANDLES);
    expect.soft(texts, 'a handle per tier-row group button').toHaveLength(HANDLES);
    expect.soft(refused, 'no handle label the walk pattern refuses').toEqual([]);
  });

  test('H-8 p90: Mekong\'s Details tab words the p90 beside the p50, clean in both themes and opening under 200 ms; neither the strip nor Path beneath says p90', async ({ page }) => {
    await openPage(page, 'multitier', panelP90);
    await cardButton(page, 'leon').click();
    await details(page, 'León Cuero').getByRole('button', { name: 'Pin', exact: true }).click();
    await cardButton(page, 'mekong').click();
    const mekong = details(page, 'Mekong Tannery');
    const history = mekong.getByRole('region', { name: 'Delivery history' });
    // setup: the panel's answer is in (the p50 words are there with or without the p90)
    await expect(history.getByText(/^Calibrated p50: 30 d/)).toBeVisible();
    const line = (await history.getByText(/^Calibrated p50: 30 d/).textContent()) ?? '';
    const panelMs = await durations(page, 'sm-panel-open');
    const axes: Record<string, string> = {};
    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);
      axes[theme] = axeLine(await axe(page));
    }
    // the strip and the Path beneath tab panel, each shown before it is searched for the word
    const strip = page.getByRole('table', { name: 'Compare pinned and active' });
    await mekong.getByRole('tab', { name: 'Path beneath' }).click();
    const pathPanel = mekong.getByRole('tabpanel', { name: 'Path beneath' });
    await pathPanel.waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
    const shown = { strip: await strip.isVisible(), pathPanel: await pathPanel.isVisible() };
    // read only what is on screen: an absent element must red the `shown` line below, not time out here
    const says = async (box: ReturnType<Page['locator']>, on: boolean) => on && ((await box.textContent()) ?? '').includes('p90');
    const said = { strip: await says(strip, shown.strip), pathPanel: await says(pathPanel, shown.pathPanel) };
    console.log(`SM_LF_P90 line=${JSON.stringify(line)} axe dark=${axes.dark} light=${axes.light}`);
    console.log(`SM_LF_PANEL_OPEN_MS browser=${JSON.stringify(panelMs)}`);
    console.log(`SM_LF_P90_NEGATIVE shown=${JSON.stringify(shown)} says_p90=${JSON.stringify(said)}`);

    expect.soft(line, 'the p90 sits beside the p50 in Mekong\'s Delivery history').toBe('Calibrated p50: 30 d · p90: 45 d');
    expect.soft(axes.dark, 'axe in dark').toBe('[]');
    expect.soft(axes.light, 'axe in light').toBe('[]');
    expect.soft(panelMs.length, 'the panel measured its opening').toBeGreaterThan(0);
    expect.soft(Math.max(...panelMs), 'sm-panel-open under 200 ms').toBeLessThan(200);
    // the negative counts only when what it searches is on screen
    expect(shown, 'the strip and the Path beneath panel are both visible').toEqual({ strip: true, pathPanel: true });
    expect.soft(said.strip, 'the strip says no p90').toBe(false);
    expect.soft(said.pathPanel, 'Path beneath says no p90').toBe(false);
  });
});
