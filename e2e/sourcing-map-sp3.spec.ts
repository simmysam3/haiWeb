import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { axe, axeLine, cardBoxes, durations, overflowing } from './sourcing-map-harness';

/**
 * Sourcing Map SP3-d (spec §12.6, ruling C-16): what only a browser can measure, through the dev-only harness route
 * /sm-harness/<fixture> (served only by a server started with SM_HARNESS=1). R-9 (< 200 ms) on each backlog's first
 * render and on the panel open; axe on both backlogs and on the panel in both themes; and the card text jsdom cannot
 * wrap: the not-traced card, and the "Select to trace" cue before any card is pressed.
 * The one BFF call, the option panel, is answered from its fixture. Skips, never throws, without SM_HARNESS_URL.
 */
const HARNESS = process.env.SM_HARNESS_URL;
const panelLeon = JSON.parse(readFileSync(path.join(process.cwd(), 'src/app/sourcing-map/__fixtures__/sp3/option-panel-leon.json'), 'utf8')) as unknown;
const BACKLOG_ROOT = '[data-testid="sp3-harness"]';

async function routePanel(page: Page): Promise<void> {
  await page.route('**/options/*/panel', (route) => route.fulfill({ json: panelLeon }));
}
const fontsSettled = (page: Page) => page.evaluate(() => document.fonts.ready.then(() => undefined));
const leonCard = (page: Page) => page.locator('section[aria-label="Sourcing map"] article', { hasText: 'León Cuero' }).first();

test.describe('Sourcing Map SP3 harness (fixtures, real browser)', () => {
  test.skip(!HARNESS, 'Needs SM_HARNESS_URL: a worktree dev server started with SM_HARNESS=1');

  for (const [fixture, measure, line] of [
    ['supply-risks', 'sm-supply-risks-render', 'SUPPLY_RISKS'],
    ['demand-exceptions', 'sm-demand-exceptions-render', 'DEMAND_EXCEPTIONS'],
  ] as const) {
    test(`${fixture}: first render < 200 ms, axe clean (R-9)`, async ({ page }) => {
      await page.goto(`${HARNESS}/sm-harness/${fixture}`);
      await expect(page.getByTestId('sp3-harness').getByRole('table')).toBeVisible();
      const ms = await durations(page, measure);
      const violations = await axe(page, BACKLOG_ROOT);
      console.log(`SM_SP3_${line}_MS browser=${JSON.stringify(ms)}`);
      console.log(`SM_SP3_${line}_AXE ${axeLine(violations)}`);
      expect(ms.length).toBeGreaterThan(0);
      expect(Math.max(...ms)).toBeLessThan(200);
      expect(violations).toEqual([]);
    });
  }

  test('multitier: the cue row fits before any press; the panel opens < 200 ms and is axe clean in both themes', async ({ page }) => {
    await routePanel(page);
    await page.goto(`${HARNESS}/sm-harness/multitier`);
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible();
    await expect(page.getByText('Select to trace').first()).toBeVisible();
    await fontsSettled(page);
    // Before León is pressed: the cards that show "Select to trace" are the ones SP2's measure never saw. One theme
    // is enough, since a theme changes colours, not metrics.
    const cue = overflowing(await cardBoxes(page));
    console.log(`SM_SP3_CUE_OVERFLOW dark=${JSON.stringify(cue)}`);

    await leonCard(page).locator('button[data-anchor]').first().click();
    await expect(page.getByText('Calibrated median: 42 d (4 orders)')).toBeVisible();
    const openMs = await durations(page, 'sm-panel-open');
    const dark = await axe(page);
    await page.getByRole('button', { name: 'Light theme' }).click();
    await expect(page.getByTestId('sm-root')).toHaveAttribute('data-theme', 'light');
    const light = await axe(page);
    console.log(`SM_SP3_PANEL_OPEN_MS browser=${JSON.stringify(openMs)}`);
    console.log(`SM_SP3_PANEL_AXE dark=${axeLine(dark)} light=${axeLine(light)}`);

    expect(cue).toEqual([]);
    expect(openMs.length).toBeGreaterThan(0);
    expect(Math.max(...openMs)).toBeLessThan(200);
    expect(dark).toEqual([]);
    expect(light).toEqual([]);
  });

  test("not-traced: León's card shows the copy and fits its box in both themes", async ({ page }) => {
    await page.goto(`${HARNESS}/sm-harness/not-traced`);
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible();
    await expect(leonCard(page).getByText('not traced below (answers for itself only)')).toBeVisible();
    await fontsSettled(page);
    const dark = overflowing(await cardBoxes(page));
    await page.getByRole('button', { name: 'Light theme' }).click();
    await expect(page.getByTestId('sm-root')).toHaveAttribute('data-theme', 'light');
    const light = overflowing(await cardBoxes(page));
    console.log(`SM_SP3_NOT_TRACED_OVERFLOW dark=${JSON.stringify(dark)} light=${JSON.stringify(light)}`);
    expect(dark).toEqual([]);
    expect(light).toEqual([]);
  });
});
