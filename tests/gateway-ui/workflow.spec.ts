import { test, expect, type BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import type { Draft, Scan } from '../../lib/gateway/schemas';

test.describe.configure({ mode: 'serial' });
let fixture: Server;
let app: ChildProcess;
let origin: string;
let appOrigin: string;
let directory: string;
let cookieValues: { name: string; value: string }[] = [];
let originalNextEnv = '';
let savedDraft: Draft;
let savedScan: Scan;
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
    GATEWAY_NEXT_DIST_DIR: '.next-gateway-tests',
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
  if (originalNextEnv)
    await writeFile(
      'next-env.d.ts',
      originalNextEnv.replace(
        './.next-gateway-tests/types/routes.d.ts',
        './.next/types/routes.d.ts',
      ),
    );
});
test.beforeEach(async ({ context }) => {
  await signIn(context);
});

test('authenticated merchant inspects, edits, approves, and runs the actual Gateway workflow', async ({
  page,
}) => {
  // A cold CI server can take longer than the default five-second assertion
  // timeout to compile its first API route. Exercise that loading state.
  await page.route(
    '**/api/gateway/environments',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      await route.continue();
    },
    { times: 1 },
  );
  const initialization = Promise.all(
    ['/api/gateway/environments', '/api/gateway/drafts'].map((path) =>
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === path && response.request().method() === 'GET',
        { timeout: 30_000 },
      ),
    ),
  );
  await page.goto(`${appOrigin}/discover`);
  for (const response of await initialization)
    expect(response.status(), `${new URL(response.url()).pathname} initialization`).toBe(200);
  await expect(page.getByLabel('Storefront URL')).toHaveValue(`${origin}/?utm_source=bridge`);
  await page.getByRole('button', { name: 'Inspect storefront', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review customer archetypes' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeDisabled();
  await page.getByRole('heading', { name: 'Review customer archetypes' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/gateway-review-desktop.png', animations: 'disabled' });
  await page
    .getByRole('region', { name: 'Shopper archetype 1', exact: true })
    .getByText('Why this shopper?')
    .click();
  await expect(
    page.getByRole('region', { name: 'Shopper archetype 1', exact: true }).locator('details'),
  ).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('heading', { name: 'Review customer archetypes' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/gateway-review-mobile.png', animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByLabel('Archetype 1 name').fill('Patient comparison shopper');
  await page
    .getByLabel('Scenario 1 goal', { exact: true })
    .fill('Inspect the Trail Pack and recommend it from observed evidence.');
  await page
    .getByLabel('I reviewed these archetypes, goals, constraints, and permitted actions.')
    .check();
  await page.getByRole('button', { name: 'Approve test plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeEnabled();
  const draftId = new URL(page.url()).searchParams.get('draft');
  savedDraft = (await (await page.request.get(`${appOrigin}/api/gateway/drafts/${draftId}`)).json())
    .data;
  expect(savedDraft.archetypes[0].provenance.source).toBe('merchant_edit');
  await page.getByRole('button', { name: 'Run approved scan' }).click();
  await expect(page.getByText('3 / 3 sessions finished', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const dashboardLink = page.getByRole('link', { name: 'Open dashboard', exact: true });
  await expect(dashboardLink).toHaveCount(1);
  await expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  await expect(
    dashboardLink.locator('..').getByRole('link', { name: 'Open saved scan' }),
  ).toBeVisible();
  const scans = await (await page.request.get(`${appOrigin}/api/gateway/scans`)).json();
  savedScan = (
    await (
      await page.request.get(`${appOrigin}/api/gateway/scans/${scans.data.items[0].id}`)
    ).json()
  ).data;
  expect(savedScan.sessions.map((session) => session.evaluation?.outcome)).toEqual([
    'passed',
    'passed',
    'passed',
  ]);
  expect(savedScan.fixture).toBe(true);
  const preview = page.getByRole('region', { name: 'Live browser preview' });
  await expect(preview.getByRole('img', { name: /^Captured browser view/ })).toBeVisible();
  const imageUrl = await preview
    .getByRole('img', { name: /^Captured browser view/ })
    .getAttribute('src');
  const imageResponse = await page.request.get(`${appOrigin}${imageUrl}`);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toBe('image/jpeg');
  expect(imageResponse.headers()['cache-control']).toBe('private, no-store');
  const bytes = await imageResponse.body();
  expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect((await fetch(`${appOrigin}${imageUrl}`)).status).toBe(401);
  await preview.getByRole('button', { name: /Shopper 2/ }).click();
  await expect(preview.getByRole('img', { name: /^Captured browser view/ })).toHaveAttribute(
    'src',
    new RegExp(savedScan.sessions[1].id),
  );
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/gateway-live-browser.png', animations: 'disabled' });

  await page.screenshot({ path: 'test-results/gateway-ui/approved-run.png', fullPage: true });
});

test('dashboard, sessions, replay and findings load persisted results across page reloads', async ({
  page,
}) => {
  await page.goto(`${appOrigin}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Storefront testing overview' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Agent readiness overview', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.readiness-grid .readiness-card')).toHaveCount(4);
  await expect(page.locator('.gateway-category').filter({ hasText: 'Checkout' })).toContainText(
    'Not yet measured',
  );
  await expect(page.getByRole('heading', { name: 'Agent readiness trend' })).toBeVisible();
  await page.screenshot({ path: 'test-results/quantitative-overview.png', fullPage: true });
  await expect(page.getByRole('link', { name: 'View scan', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'View scan', exact: true }).click();
  await expect(page.getByText('3 / 3 sessions finished', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View sessions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shopping sessions' })).toBeVisible();
  await page.getByLabel('Filter by test mode').selectOption('constraint');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: /Inspect \d+ events/ }).click();
  await expect(page.getByRole('heading', { name: 'Session replay' })).toBeVisible();
  await page.getByRole('tab', { name: 'Evaluation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Independent outcome evaluation' })).toBeVisible();
  await expect(
    page.getByText('Fixture semantic verdict; not an independent AI assessment.'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Model usage' }).click();
  await expect(page.getByRole('cell', { name: 'evaluator', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toContain('gateway-session-');
  await page.goto(`${appOrigin}/recommendations`);
  expect(savedScan.findings).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Nothing to fix yet' })).toBeVisible();
  await expect(page.getByText('0 findings', { exact: true })).toBeVisible();
  await page.goto(`${appOrigin}/replays/00000000-0000-4000-8000-000000000099`);
  await expect(page.locator('.gateway-error')).toContainText('Session not found');
});

test('saved plans survive reload, edits revoke approval, and stale revisions are recoverable', async ({
  page,
}) => {
  await page.goto(`${appOrigin}/discover?draft=${savedDraft.id}`);
  await expect(page.getByLabel('Archetype 1 name')).toHaveValue('Patient comparison shopper');
  await page.getByLabel('Archetype 1 name').fill('Edited again');
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeDisabled();
  const response = await page.request.patch(`${appOrigin}/api/gateway/drafts/${savedDraft.id}`, {
    data: {
      revision: savedDraft.revision,
      archetypes: savedDraft.archetypes,
      scenarios: savedDraft.scenarios,
      approved: false,
    },
  });
  expect(response.ok()).toBe(true);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.gateway-error')).toContainText('Reload the latest draft');
  await page.getByRole('button', { name: 'Reload latest revision' }).click();
  await expect(page.getByLabel('Archetype 1 name')).toHaveValue('Patient comparison shopper');
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Storefront URL').fill(`${origin}/search`);
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toHaveCount(0);
});

test('configuration errors stay visible and never produce a scripted success', async ({ page }) => {
  await page.route('**/api/gateway/drafts', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            apiVersion: 'v1',
            error: {
              code: 'CONFIGURATION_ERROR',
              message: 'OPENAI_API_KEY is required.',
              retryable: false,
            },
          }),
        })
      : route.continue(),
  );
  await page.goto(`${appOrigin}/discover`);
  await page.getByRole('button', { name: 'Inspect storefront', exact: true }).click();
  await expect(page.locator('.gateway-error')).toContainText('OPENAI_API_KEY is required.');
  await expect(page.getByRole('button', { name: 'Approve test plan' })).toHaveCount(0);
  const retired = await page.request.post(`${appOrigin}/api/agent-scan`, { data: {} });
  expect(retired.status()).toBe(410);
});

test('API authorization remains enforced independently of the public discovery page', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const response = await context.request.get(`${appOrigin}/api/gateway/dashboard`);
    expect(response.status()).toBe(401);
    const page = await context.newPage();
    await page.goto(`${appOrigin}/discover`);
    await expect(page.getByRole('alert').filter({ hasText: 'Sign in to inspect' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Inspect storefront', exact: true }),
    ).toBeDisabled();
  } finally {
    await context.close();
  }
});

test('merged main retains demand simulation, visual demo replay and reporting pages', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appOrigin}/demand-signal`);
  await expect(page.getByRole('heading', { name: 'Demand Signal', exact: true })).toBeVisible();
  await expect(
    page.getByText('Demo simulation using fixture persona reactions and scores.'),
  ).toBeVisible();
  await page.goto(`${appOrigin}/replays/SES-10482`);
  await expect(
    page.getByText('Demo replay — illustrative storefront actions, not a recorded Gateway scan.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Investigation view', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Safety controls held', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Watch visual replay' }).click();
  await expect(page.getByRole('dialog')).toContainText('Visual replay · SES-10482');
  for (const [route, heading] of [
    ['analytics', 'Analytics'],
    ['security', 'Security'],
  ]) {
    await page.goto(`${appOrigin}/${route}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('evaluator reports feed quantitative blocks and inconclusive scores remain unmeasured', async ({
  page,
}) => {
  const evidenceId = savedScan.sessions[0].trace.find((event) => event.observation)!.observation!
    .id;
  const response = await page.request.post(
    `${appOrigin}/api/gateway/scans/${savedScan.id}/readiness`,
    {
      data: {
        category: 'compatibility',
        producer: 'independent-schema-evaluator',
        description: 'Explicit product schema checks.',
        unit: 'schema checks',
        checks: [
          { id: 'price', label: 'Price present', result: 'pass', evidenceIds: [evidenceId] },
          { id: 'currency', label: 'Currency missing', result: 'fail', evidenceIds: [evidenceId] },
          {
            id: 'coverage',
            label: 'Coverage unknown',
            result: 'unknown',
            evidenceIds: [evidenceId],
          },
        ],
      },
    },
  );
  expect(response.status()).toBe(200);
  await page.goto(`${appOrigin}/dashboard`);
  const card = page.locator('.gateway-category').filter({ hasText: 'Compatibility' });
  await expect(card).toContainText('50%');
  await expect(card).toContainText('independent-schema-evaluator');
  await page.reload();
  await expect(card).toContainText('50%');
  const payload = await (await page.request.get(`${appOrigin}/api/gateway/dashboard`)).json();
  payload.data.readiness.score = null;
  payload.data.readiness.passed = 0;
  payload.data.readiness.failed = 0;
  payload.data.readiness.inconclusive = 3;
  payload.data.readiness.trend = payload.data.readiness.trend.map((point: unknown) => ({
    ...(point as object),
    score: null,
  }));
  await page.route('**/api/gateway/dashboard', (route) => route.fulfill({ json: payload }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'More evidence needed' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Goal readiness: not yet measured' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  await page.screenshot({
    path: 'test-results/quantitative-overview-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('all workspace and authentication pages share responsive visual layouts', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const routes = [
    'dashboard',
    'discover',
    `scan?scanId=${savedScan.id}`,
    'demand-signal',
    'sessions',
    'replays',
    `replays/${savedScan.sessions[0].id}`,
    'replays/SES-10482',
    'recommendations',
    'security',
    'analytics',
    'integrations',
    'settings',
    'replays/SES-invalid',
  ];
  for (const width of [1440, 390, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [index, route] of routes.entries()) {
      await page.goto(`${appOrigin}/${route}`);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('[role="status"]').filter({ hasText: /Loading/ })).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Application error');
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), {
          message: `${route} overflows at ${width}px`,
        })
        .toBe(true);
      if (width === 390 && route !== 'discover')
        await expect(page.locator('.sidebar')).not.toBeInViewport();
      await page.screenshot({
        path: info.outputPath(
          `${width}-${String(index).padStart(2, '0')}-${route.split('?')[0].replaceAll('/', '-')}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
  expect(errors).toEqual([]);
  const anonymous = await browser.newContext();
  try {
    const auth = await anonymous.newPage();
    for (const width of [1440, 390]) {
      await auth.setViewportSize({ width, height: 1000 });
      for (const route of ['login', 'signup']) {
        await auth.goto(`${appOrigin}/${route}`);
        await expect(auth.getByLabel('Work email')).toBeVisible();
        expect(await auth.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await auth.screenshot({
          path: info.outputPath(`${width}-${route}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  } finally {
    await anonymous.close();
  }
});

test('scan execution shows measured progress and interrupted states without implying success', async ({
  page,
}) => {
  const runningScan: Scan = {
    ...savedScan,
    status: 'running',
    completedAt: null,
    sessions: savedScan.sessions.map((session, index) =>
      index === 0
        ? session
        : {
            ...session,
            status: index === 1 ? 'running' : 'queued',
            completedAt: null,
            evaluation: null,
            trace: index === 1 ? session.trace.slice(0, 1) : [],
          },
    ),
  };
  await page.route(`**/api/gateway/scans/${savedScan.id}`, async (route) => {
    await route.fulfill({ json: { apiVersion: 'v1', data: runningScan } });
  });
  await page.goto(`${appOrigin}/scan?scanId=${savedScan.id}`);
  await expect(page.getByRole('heading', { name: 'Shoppers are exploring' })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Shopping session progress' }),
  ).toHaveAttribute('aria-valuenow', '1');
  await expect(
    page.getByRole('region', { name: 'Shopper sessions' }).getByRole('article'),
  ).toHaveCount(3);
  await page.getByRole('region', { name: 'Scan execution' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/gateway-execution-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/gateway-execution-mobile.png', animations: 'disabled' });
  runningScan.status = 'interrupted';
  runningScan.sessions[1].status = 'interrupted';
  await expect(page.getByRole('heading', { name: 'Scan needs attention' })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByRole('progressbar', { name: 'Shopping session progress' }),
  ).toHaveAttribute('aria-valuenow', '2');
});
