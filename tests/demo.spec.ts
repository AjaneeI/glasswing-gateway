import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.GATEWAY_TEST_STORAGE_STATE });
test.beforeEach(() => {
  test.skip(
    !process.env.GATEWAY_TEST_STORAGE_STATE,
    'Workspace tests require an authenticated Supabase storage state.',
  );
});

test('all demo routes render without client errors and primary surfaces are captured', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [route, heading] of [
    ['dashboard', 'Storefront testing overview'],
    ['scan', 'Agent test run'],
    ['sessions', 'Shopping Sessions'],
    ['security', 'Security'],
    ['recommendations', 'Findings & next steps'],
    ['analytics', 'Analytics'],
    ['integrations', 'Integrations'],
    ['settings', 'Settings'],
    ['replays', 'Session replays'],
  ]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (['dashboard', 'scan', 'sessions'].includes(route)) {
      await page.screenshot({
        path: `test-results/${route.replaceAll('/', '-')}-desktop.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
  expect(errors).toEqual([]);
});

test('scan entry points lead to merchant review instead of simulated completion', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Run Scan', exact: true }).click();
  await expect(page).toHaveURL('/discover');
  await expect(page.getByRole('button', { name: 'Inspect storefront', exact: true })).toBeVisible();
  await page.goto('/sessions');
  await page.getByRole('link', { name: 'Run shopping tests' }).click();
  await expect(page).toHaveURL('/discover');
});

test('policy editing and new policy submission', async ({ page }) => {
  await page.goto('/security');
  await page
    .getByRole('button', { name: 'Edit policy: Purchase confirmation', exact: true })
    .click();
  await page.getByLabel('Enforcement', { exact: true }).fill('Require signed confirmation');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(
    page.locator('tbody tr').filter({ hasText: 'Purchase confirmation' }).first(),
  ).toContainText('Require signed confirmation');
  await page.getByRole('button', { name: 'New policy' }).click();
  await page.getByLabel('Policy name').fill('Prevent checkout retries');
  await page.getByLabel('Policy scope').selectOption('Checkout');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.locator('.policy-table tbody tr')).toHaveCount(6);
  await expect(page.locator('.policy-table')).toContainText('Prevent checkout retries');
});

test('analytics date range and integration connection', async ({ page }) => {
  await page.goto('/analytics');
  await page.getByRole('button', { name: '30d', exact: true }).click();
  await expect(page.getByText('across 5,312 sessions')).toBeVisible();
  await page.getByRole('button', { name: '90d', exact: true }).click();
  await expect(page.getByText('across 16,407 sessions')).toBeVisible();
  await page.goto('/integrations');
  await page.getByLabel('Search integrations').fill('Stripe');
  const stripe = page.getByRole('article', { name: 'Stripe', exact: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  await stripe.getByRole('button', { name: 'Configure Stripe' }).click();
  await page.getByLabel('Connection name').fill('Evertrail payments');
  await page.getByLabel('Stripe dashboard URL').fill('https://dashboard.stripe.com/test/dashboard');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(stripe).toContainText('Configured');
  await expect(stripe.getByRole('link', { name: 'Open Stripe', exact: true })).toHaveAttribute(
    'href',
    'https://dashboard.stripe.com/test/dashboard',
  );
});

test('tablet and mobile layouts stay within viewport, navigation works', async ({ page }) => {
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      'dashboard',
      'scan',
      'sessions',
      'security',
      'recommendations',
      'analytics',
      'integrations',
    ]) {
      await page.goto(`/${route}`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${route} overflows at ${width}px`,
      ).toBe(true);
    }
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Security', exact: true })
      .click();
    await expect(page).toHaveURL(/\/security/);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.screenshot({ path: `test-results/security-${width}.png`, fullPage: true });
  }
});

test('invalid replay shows a proper not-found page and session alias redirects', async ({
  page,
}) => {
  await page.goto('/replays/SES-invalid');
  await expect(
    page.getByRole('heading', { name: 'This page isn’t in your workspace.' }),
  ).toBeVisible();
  await page.goto('/sessions/00000000-0000-4000-8000-000000000099');
  await expect(page).toHaveURL(/\/replays\/00000000-0000-4000-8000-000000000099/);
  await expect(page.getByRole('heading', { name: 'Session replay', exact: true })).toBeVisible();
});
