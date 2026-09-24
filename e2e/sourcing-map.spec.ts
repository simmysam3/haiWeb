import { test, expect, type Page } from '@playwright/test';

/**
 * Sourcing Map SP1 walk (spec §12, AC 21). Runs only in SP1-e's walk on the
 * owner's word: it needs the live stack and the Vomero agents (all DOWN while
 * SP1-d is built). Skips — never throws — when its credentials are absent.
 *
 * Env: SM_CSG_EMAIL / SM_CSG_PASSWORD (csg.demo@haiwave.test, spec §4 fact 3),
 * SM_BOM_FILE (SP1-e's seed-data/sourcing-map BOM, .xlsx or .csv),
 * optional SM_VIEWER_EMAIL / SM_VIEWER_PASSWORD (a buyer_view_only user, AC 1).
 */
const HAIWEB = process.env.HAIWEB_BASE_URL ?? 'http://localhost:3001';
const EMAIL = process.env.SM_CSG_EMAIL;
const PASSWORD = process.env.SM_CSG_PASSWORD;
const BOM_FILE = process.env.SM_BOM_FILE;

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${HAIWEB}/api/auth/login?next=/sourcing-map`);
  await page.locator('#username, input[name="username"], input[type="email"]').first().fill(email);
  await page.locator('#password, input[type="password"]').first().fill(password);
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click();
  // Both the CSG user and a wrong-role viewer land on /sourcing-map (the viewer's page is the 403,
  // rendered in place by forbidden() — the URL still matches), so the settle-wait belongs here (fix round 1, I-2).
  await page.waitForURL(/\/sourcing-map(\/|$|\?)/);
}

test.describe('Sourcing Map walk (CSG)', () => {
  test.skip(!EMAIL || !PASSWORD || !BOM_FILE, 'Needs SM_CSG_EMAIL, SM_CSG_PASSWORD and SM_BOM_FILE; runs only in the SP1-e walk');

  test('project → upload BOM → map → resolve → run → demand → Run → map with pips → drops → product filter', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    await login(page, EMAIL!, PASSWORD!);
    const stamp = new Date().toISOString().slice(0, 16);

    await page.getByRole('button', { name: '+ New project' }).click();
    await page.getByLabel('Project name').fill(`Walk ${stamp}`);
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.waitForURL(/\/sourcing-map\/[0-9a-f-]{36}$/);

    await page.getByRole('tab', { name: 'Product library' }).click();
    await page.getByRole('button', { name: '+ New product' }).click();
    await page.getByLabel('Product name').fill('Walk trainer');
    await page.getByLabel('Assembly days').fill('21');
    await page.getByRole('button', { name: 'Create product' }).click();
    await page.waitForURL(/\/products\/[0-9a-f-]{36}$/);
    // Whole sizes: SP1-e's SM_BOM_FILE, the long-layout CSV (its e-G6), names whole sizes 7–13, so the axis is 6–15 without half sizes.
    await page.getByLabel('Half sizes').uncheck();
    await page.getByLabel('Variant preset').selectOption('mens_us_6_15');
    await page.getByRole('button', { name: 'Save product' }).click();
    // Fix round 1, I-1: `save()` (product-editor.tsx) clears `busy` as soon as the PATCH resolves, before
    // `setProduct(...)` and `router.refresh()`. The PATCH changes `variant_axis`, and the refresh re-keys
    // `ProductEditorBody` (products/[productId]/page.tsx: `key={editorKey(detail)}`), remounting it and
    // resetting `uploading` — closing the wizard mid-flow if it opened first, or opening it with the stale
    // (pre-save) axis if a click lands before the refresh. No element on this screen (a brand-new product,
    // no BOM lines yet) renders anything driven by the refreshed `detail` prop rather than by `ProductEditor`'s
    // own local `product`/`axis` state: the readiness Pill and the Variant preset select both already show the
    // right value from local state well before the refresh lands, and `BomGrid`'s only axis-dependent markup
    // (the per-line "Size-bound" checkbox) has no rows to render it against yet. So there is no deterministic,
    // already-built DOM signal to wait on here — falling back to a network-settle wait instead.
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Upload BOM' }).click();
    await page.getByLabel('Spreadsheet file').setInputFiles(BOM_FILE!);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Accept all confident' }).click();
    await page.getByRole('button', { name: 'Continue to review' }).click();
    await page.getByRole('button', { name: /^Save \d+ lines?$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Upload BOM' })).toBeHidden();

    await page.getByRole('link', { name: `Walk ${stamp}` }).click();
    await page.getByRole('button', { name: '+ New run' }).click();
    await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Add a product').selectOption({ label: 'Walk trainer' });
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Generate drops for Walk trainer' }).click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('complementary', { name: 'Configure run' })).toBeHidden();

    const run = page.getByRole('button', { name: 'Run' });
    await expect(run).toBeEnabled({ timeout: 30_000 });
    await run.click();
    await expect(page.getByRole('region', { name: 'Sourcing map' })).toBeVisible({ timeout: 5 * 60_000 });
    await expect(page.getByRole('img', { name: /covered|no answer/ }).first()).toBeVisible({ timeout: 5 * 60_000 });

    const renderMs = await page.evaluate(() => performance.getEntriesByName('sm-map-render').map((e) => e.duration));
    console.log(`SM_MAP_RENDER_MS browser=${JSON.stringify(renderMs)}`);

    const drops = page.getByRole('group', { name: 'Drops: choose the drop the map shows' }).getByRole('button');
    await drops.first().click();
    await expect(page).toHaveURL(/[?&]drop=\d{4}-\d{2}-\d{2}/);

    const products = page.getByRole('group', { name: 'Filter by product' });
    await products.getByRole('button', { name: /^Walk trainer/ }).click();
    await expect(products.getByRole('button', { name: /^Walk trainer/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Sourcing Map access (AC 1)', () => {
  const viewer = process.env.SM_VIEWER_EMAIL;
  const viewerPassword = process.env.SM_VIEWER_PASSWORD;
  test.skip(!viewer || !viewerPassword, 'Needs SM_VIEWER_EMAIL and SM_VIEWER_PASSWORD (a buyer_view_only user)');

  test('a role outside the account_admin family gets 403 and no nav item', async ({ page }) => {
    await login(page, viewer!, viewerPassword!);
    const res = await page.goto(`${HAIWEB}/sourcing-map`);
    expect(res?.status()).toBe(403);
    await page.goto(`${HAIWEB}/account`);
    await expect(page.getByRole('link', { name: 'Sourcing Map' })).toHaveCount(0);
    const api = await page.request.get(`${HAIWEB}/api/account/sourcing-map/projects`);
    expect(api.status()).toBe(403);
  });
});
