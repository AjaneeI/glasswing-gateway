import { expect, test } from '@playwright/test';

test('workspace and account endpoint reject unauthenticated requests', async ({
  page,
  request,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const response = await request.get('/api/account');
  expect(response.status()).toBe(401);
});

test('signup form validates fields and offers password visibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL('/signup');
  await page.getByLabel('Full name').fill('Test Member');
  await page.getByLabel('Work email').fill('test@example.com');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('unconfigured providers explain availability and return focus', async ({ page }) => {
  await page.goto('/login');
  for (const button of ['Continue with Google', 'Continue with SSO', 'Forgot password?']) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page.getByLabel('Work email')).toBeFocused();
  }
});

test('invalid confirmation cannot open a workspace', async ({ page }) => {
  await page.goto('/auth/callback?code=invalid');
  await expect(page).toHaveURL('/login?error=confirmation');
  await expect(page.getByRole('alert').filter({ hasText: 'invalid or expired' })).toBeVisible();
});

test('login and signup fit mobile and desktop', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 992 });
    for (const route of ['/login', '/signup']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});

test('live account can sign in, read its profile, and sign out', async ({ page }) => {
  test.skip(
    !process.env.GATEWAY_TEST_EMAIL || !process.env.GATEWAY_TEST_PASSWORD,
    'Requires a confirmed Supabase test account and applied migration.',
  );
  await page.goto('/login');
  await page.getByLabel('Work email').fill(process.env.GATEWAY_TEST_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.GATEWAY_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/discover', { timeout: 20000 });
  const response = await page.request.get('/api/account');
  expect(response.ok()).toBe(true);
  const account = await response.json();
  expect(account.user.email).toBe(process.env.GATEWAY_TEST_EMAIL);
  expect(account.profile.id).toBe(account.user.id);
  await page.goto('/dashboard');
  await page.locator('.user-menu').click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect((await page.request.get('/api/account')).status()).toBe(401);
});
