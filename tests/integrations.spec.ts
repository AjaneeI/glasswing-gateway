import { test, expect, type BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createServerClient } from '@supabase/ssr';

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);
let fixture: Server;
let app: ChildProcess;
let origin: string;
let appOrigin: string;
let directory: string;
let cookieValues: { name: string; value: string }[] = [];
let originalNextEnv = '';
let originalTsConfig = '';
const ownerId = '00000000-0000-4000-8000-000000000001';
const user = {
  id: ownerId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'fixture@gateway.test',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
async function signIn(context: BrowserContext) {
  await context.addCookies(cookieValues.map((cookie) => ({ ...cookie, url: appOrigin })));
}
test.beforeAll(async () => {
  originalNextEnv = await readFile('next-env.d.ts', 'utf8');
  originalTsConfig = await readFile('tsconfig.json', 'utf8');
  directory = await mkdtemp(join(tmpdir(), 'gateway-bridge-'));
  fixture = createServer((request, response) => {
    if (request.url?.startsWith('/auth/v1/user')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(user));
      return;
    }
    if (request.url?.startsWith('/rest/v1/profiles')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ id: ownerId, full_name: 'Fixture Merchant' }));
      return;
    }
    response.setHeader('Content-Type', 'text/html');
    if (request.url?.startsWith('/products/pack'))
      response.end(
        '<html><title>Trail Pack</title><body><h1>Trail Pack</h1><p>Blue hiking backpack for $89 USD.</p><script type="application/ld+json">{"@type":"Product","name":"Trail Pack","offers":{"price":"89","priceCurrency":"USD"}}</script></body></html>',
      );
    else
      response.end(
        '<html><title>Bridge Test Store</title><body><h1>Hiking essentials</h1><a href="/products/pack">Trail Pack</a></body></html>',
      );
  });
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  const portServer = createServer();
  await new Promise<void>((resolve) => portServer.listen(0, '127.0.0.1', resolve));
  const port = (portServer.address() as { port: number }).port;
  await new Promise<void>((resolve) => portServer.close(() => resolve()));
  appOrigin = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
    NEXT_PUBLIC_SITE_URL: appOrigin,
    GATEWAY_MODEL_MODE: 'fixture',
    GATEWAY_DATA_DIR: directory,
    GATEWAY_NEXT_DIST_DIR: '.next-integrations-tests',
    GATEWAY_TEST_ENVIRONMENTS: JSON.stringify([
      {
        id: 'bridge-fixture',
        origin,
        entryPath: '/?utm_source=bridge',
        allowedPathPrefixes: ['/', '/products', '/search'],
        searchPath: '/search',
        searchQueryParam: 'q',
        allowLoopback: true,
      },
    ]),
  };
  const chromium = join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
  if (existsSync(chromium)) Object.assign(env, { GATEWAY_CHROMIUM_PATH: chromium });
  app = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: process.cwd(), env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let startup = '';
  app.stdout?.on('data', (chunk) => {
    startup = (startup + chunk).slice(-8000);
  });
  app.stderr?.on('data', (chunk) => {
    startup = (startup + chunk).slice(-8000);
  });
  await expect
    .poll(
      async () => {
        if (app.exitCode !== null) throw new Error(`Test app stopped: ${startup}`);
        try {
          return (await fetch(`${appOrigin}/discover`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 90_000, intervals: [500, 1000] },
    )
    .toBe(200);
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        sub: ownerId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: 'authenticated',
      }),
    ).toString('base64url'),
    Buffer.from('fixture-signature').toString('base64url'),
  ].join('.');
  const auth = createServerClient(origin, 'fixture-public-key', {
    cookies: {
      getAll: () => [],
      setAll: (values) => {
        cookieValues = values.map(({ name, value }) => ({ name, value }));
      },
    },
  });
  const { error } = await auth.auth.setSession({
    access_token: token,
    refresh_token: 'fixture-refresh',
  });
  if (error) throw error;
});
test.afterAll(async () => {
  if (app?.pid) {
    try {
      process.kill(-app.pid, 'SIGTERM');
    } catch {}
  }
  if (fixture?.listening) await new Promise<void>((resolve) => fixture.close(() => resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
  if (originalNextEnv) await writeFile('next-env.d.ts', originalNextEnv);
  if (originalTsConfig) await writeFile('tsconfig.json', originalTsConfig);
});
test.beforeEach(async ({ context }) => {
  await signIn(context);
});

test('integration links save, open their destination, survive reload, and can be removed', async ({
  page,
}) => {
  await page.goto(`${appOrigin}/integrations`);
  const github = page.getByRole('article', { name: 'GitHub', exact: true });
  await expect(github).toBeVisible();
  await expect(page.getByText('0 configured', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(9);
  await expect(page.getByRole('img', { name: 'GitHub logo' }).last()).toBeVisible();
  await page.screenshot({
    path: '/tmp/gateway-integrations-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await github.getByRole('button', { name: 'Configure GitHub' }).click();
  await page.getByLabel('Connection name').fill('Storefront repository');
  await page.getByLabel('Repository URL').fill('http://github.com/merchant/storefront');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'HTTPS' })).toBeVisible();
  await page.getByLabel('Repository URL').fill('https://github.com/merchant/storefront');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(github.getByRole('link', { name: 'Open GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/merchant/storefront',
  );
  await expect(github.getByRole('link', { name: 'Open GitHub', exact: true })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(page.getByText('1 configured', { exact: true })).toBeVisible();
  await page.reload();
  await expect(github.getByRole('link', { name: 'Open GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/merchant/storefront',
  );
  await page.getByRole('button', { name: 'Configured', exact: false }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await github.getByRole('button', { name: 'Configure GitHub' }).click();
  await page.getByRole('button', { name: 'Remove link' }).click();
  await expect(page.getByText('Your tools belong here')).toBeVisible();
  await expect(page.getByText('0 configured', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('0 configured', { exact: true })).toBeVisible();
});

test('directory filters, documentation links, and responsive layouts work', async ({ page }) => {
  await page.goto(`${appOrigin}/integrations`);
  await expect(page.getByRole('article')).toHaveCount(9);
  await page.getByRole('button', { name: 'Payments', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  const stripe = page.getByRole('article', { name: 'Stripe', exact: true });
  await expect(stripe.getByRole('link', { name: 'Stripe documentation' })).toHaveAttribute(
    'href',
    'https://docs.stripe.com',
  );
  await page.getByLabel('Search integrations').fill('not a service');
  await expect(page.getByRole('heading', { name: 'No integrations found' })).toBeVisible();
  await page.getByRole('button', { name: 'Browse all integrations' }).click();
  await expect(page.getByRole('article')).toHaveCount(9);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 375)
      await page.screenshot({
        path: '/tmp/gateway-integrations-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
  }
});
