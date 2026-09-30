import type { Page } from '@playwright/test';

const HAIWEB = process.env.HAIWEB_BASE_URL ?? 'http://localhost:3001';

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${HAIWEB}/api/auth/login?next=/sourcing-map`);
  await page.locator('#username, input[name="username"], input[type="email"]').first().fill(email);
  await page.locator('#password, input[type="password"]').first().fill(password);
  await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click();
  // Both the CSG user and a wrong-role viewer land on /sourcing-map (the viewer's page is the 403,
  // rendered in place by forbidden() — the URL still matches), so the settle-wait belongs here (fix round 1, I-2).
  await page.waitForURL(/\/sourcing-map(\/|$|\?)/);
}
