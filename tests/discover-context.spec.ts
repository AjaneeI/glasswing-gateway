import { buildIntakeContext, defaultScanConfig } from '../lib/agent/intake';
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
    GATEWAY_NEXT_DIST_DIR: '.next-discover-tests',
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

test('shopper interests reach intake and domain goals while explicit goals keep priority', async () => {
  const config = { ...defaultScanConfig, interests: ['home', 'tech', 'unknown'], budget: 100 };
  const intake = await buildIntakeContext('example.com', config);
  expect(intake.interests).toEqual(['home', 'tech']);
  expect(intake.goals).toHaveLength(2);
  expect(intake.goals[0]).toContain('comfort at home');
  expect(intake.goals[0]).toContain('USD 100');
  const explicit = await buildIntakeContext('example.com find a backpack under $80', config);
  expect(explicit.goals).toEqual(['example.com find a backpack under $80']);
  expect(explicit.budget).toBe(80);
});

test('interest picker feeds the storefront review workflow without redirecting to the swarm loader', async ({
  page,
}) => {
  await page.goto(`${appOrigin}/discover`);
  await expect(page.getByRole('button', { name: 'Inspect storefront', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'What are they shopping for?' })).toBeVisible();
  const outdoor = page.getByRole('button', { name: 'Outdoor adventures', exact: true });
  await outdoor.click();
  await expect(outdoor).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Home & living', exact: true }).click();
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect storefront', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page
        .locator('button img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: '/tmp/gateway-discover-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/gateway-discover-mobile.png', fullPage: true });
  const request = page.waitForRequest(
    (request) => request.url().endsWith('/api/gateway/drafts') && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Inspect storefront', exact: true }).click();
  expect((await request).postDataJSON().shopperInterests).toEqual(['outdoors', 'home']);
  await expect(
    page.getByRole('heading', { name: 'Review shopping scenarios', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/discover/);
  expect(page.url()).not.toContain('/scanning');
});
