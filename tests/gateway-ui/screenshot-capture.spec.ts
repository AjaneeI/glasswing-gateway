import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import type { Scan } from '../../lib/gateway/schemas';

// Opt-in: a normal bridge run must not overwrite reviewed portfolio assets.
test.skip(process.env.GATEWAY_CAPTURE_SCREENSHOTS !== '1', 'Explicit screenshot capture only.');
test.setTimeout(240_000);
const assetDir = join(process.cwd(), 'docs/assets/screenshots');
const ownerId = '00000000-0000-4000-8000-000000000002';
let fixture: Server;
let app: ChildProcess;
let store: string;
let origin: string;
let appOrigin: string;
let cookies: { name: string; value: string }[] = [];

test.beforeAll(async () => {
  store = await mkdtemp(join(tmpdir(), 'gateway-capture-'));
  await mkdir(assetDir, { recursive: true });
  fixture = createServer((request, response) => {
    if (request.url?.startsWith('/auth/v1/user')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          id: ownerId,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'fixture@gateway.test',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-10-14T00:00:00Z',
        }),
      );
      return;
    }
    if (request.url?.startsWith('/rest/v1/profiles')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ id: ownerId, full_name: 'Fixture Merchant' }));
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const product = request.url?.startsWith('/products/pack');
    // Authored test storefront, not a screenshot overlay or a mocked Gateway result.
    response.end(`<!doctype html><html><head><title>${product ? 'Trail Pack' : 'Gateway Fixture Store'}</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{font-family:system-ui;margin:0;background:#f5f7f5;color:#17372b}header{padding:24px 40px;background:#183d30;color:white}
      main{margin:48px auto;max-width:900px;padding:32px;background:white;border:1px solid #d8e2dc;border-radius:18px}
      p{line-height:1.6}a{color:#126c4f}small{color:#517263}h1{font-size:40px}strong{font-size:28px}</style></head>
      <body><header>GATEWAY FIXTURE STORE · LOCAL TEST ONLY</header><main>
      ${product ? '<small>HIKING ESSENTIALS / BACKPACKS</small><h1>Trail Pack</h1><p>Blue hiking backpack with a 24 litre capacity.</p><strong>$89 USD</strong><p>Fictional product. No cart, checkout, payment, or purchase capability.</p><script type="application/ld+json">{"@type":"Product","name":"Trail Pack","offers":{"price":"89","priceCurrency":"USD"}}</script>' : '<small>AUTHORIZED LOCAL FIXTURE</small><h1>Hiking essentials</h1><p>A single-product test catalog for reviewing browser evidence and budget constraints.</p><a href="/products/pack">Inspect Trail Pack — $89 USD</a>'}
      </main></body></html>`);
  });
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  const reservation = createServer();
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  appOrigin = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    OPENAI_API_KEY: '',
    NEXT_PUBLIC_SUPABASE_URL: origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
    NEXT_PUBLIC_SITE_URL: appOrigin,
    GATEWAY_MODEL_MODE: 'fixture',
    GATEWAY_DATA_DIR: store,
    GATEWAY_NEXT_DIST_DIR: '.next-gateway-capture',
    GATEWAY_TEST_ENVIRONMENTS: JSON.stringify([
      {
        id: 'portfolio-fixture',
        origin,
        allowedPathPrefixes: ['/', '/products', '/search'],
        searchPath: '/search',
        searchQueryParam: 'q',
        allowLoopback: true,
      },
    ]),
  };
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
        if (app.exitCode !== null) throw new Error(`Capture app stopped: ${startup}`);
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
        cookies = values.map(({ name, value }) => ({ name, value }));
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
  if (store) await rm(store, { recursive: true, force: true });
});

test('capture one genuine reviewed fixture workflow, including a failed budget constraint', async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: appOrigin })));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${appOrigin}/discover`);
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('interest-illustrations.png'), fullPage: true });
  await page.getByRole('button', { name: 'Inspect storefront', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review customer archetypes' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeDisabled();
  await page
    .getByRole('heading', { name: 'Gateway Fixture Store', exact: true })
    .evaluate((element) => {
      element.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
    });
  await page.screenshot({ path: join(assetDir, '01-discover.png'), animations: 'disabled' });

  // This is a merchant plan edit BEFORE approval, never an alteration of output.
  await page
    .getByLabel('Scenario 1 goal', { exact: true })
    .fill(
      'Recommend a hiking backpack only if its observed price is at most $50 USD; otherwise decline.',
    );
  await page.getByRole('button', { name: '+ Add constraint', exact: true }).first().click();
  await page.getByLabel('Scenario 1 constraint 1 value', { exact: true }).fill('50');
  await page
    .getByLabel('Scenario 1 constraint 1 description', { exact: true })
    .fill('The observed product must cost no more than $50 USD.');
  await page
    .getByLabel('I reviewed these archetypes, goals, constraints, and permitted actions.')
    .check();
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeDisabled();
  await page.getByRole('button', { name: 'Run approved scan' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(assetDir, '02-approval.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Approve test plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run approved scan' })).toBeEnabled();
  const draftId = new URL(page.url()).searchParams.get('draft');
  await page.getByRole('button', { name: 'Run approved scan' }).click();
  await expect(page.getByText('3 / 3 sessions finished', { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const list = (await (await page.request.get(`${appOrigin}/api/gateway/scans`)).json()).data;
  const scan: Scan = (
    await (await page.request.get(`${appOrigin}/api/gateway/scans/${list.items[0].id}`)).json()
  ).data;
  expect(scan.fixture).toBe(true);
  expect(scan.draft.id).toBe(draftId);
  expect(scan.sessions.map((session) => session.evaluation?.outcome)).toEqual([
    'failed',
    'passed',
    'passed',
  ]);
  expect(scan.sessions[0].evaluation?.deterministic.some((check) => check.result === 'fail')).toBe(
    true,
  );
  expect(scan.findings.length).toBeGreaterThan(0);
  expect(scan.sessions.flatMap((session) => session.modelCalls).every((call) => call.fixture)).toBe(
    true,
  );
  await page.goto(`${appOrigin}/scan?scanId=${scan.id}`);
  await expect(page.getByText('3 / 3 sessions finished', { exact: true })).toBeVisible();
  const preview = page.getByRole('region', { name: 'Live browser preview' });
  await expect(preview.getByRole('img', { name: /^Captured browser view/ })).toBeVisible();
  await page.getByRole('region', { name: 'Scan execution' }).evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -90);
  });
  await page.screenshot({ path: join(assetDir, '03-scan.png'), animations: 'disabled' });

  const failed = scan.sessions[0];
  const observed = failed.trace.find((event) => event.observation?.kind === 'product')!;
  await page.goto(`${appOrigin}/replays/${failed.id}?evidence=${observed.id}`);
  await expect(page.getByRole('heading', { name: 'Session replay', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Inspect product/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Recorded storefront: Trail Pack' })
        .evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.screenshot({ path: join(assetDir, '04-replay.png'), animations: 'disabled' });
  await page.getByRole('tab', { name: 'Evaluation', exact: true }).click();
  await expect(
    page.getByText('Fixture semantic verdict; not an independent AI assessment.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('evaluation-support.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto(`${appOrigin}/recommendations`);
  await expect(
    page.getByRole('heading', { name: 'Findings & next steps', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watch what the shopper did' })).toHaveAttribute(
    'href',
    new RegExp(failed.id),
  );
  await page.getByText('Technical detail', { exact: true }).click();
  await expect(page.getByText('Loading findings…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: join(assetDir, '05-findings.png'), animations: 'disabled' });
  await expect(page.locator('body')).not.toContainText('Application error');
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('capture-evidence.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        viewport: { width: 1440, height: 1000 },
        appOrigin,
        storefrontOrigin: origin,
        fixtureAuthentication: true,
        fixtureModels: true,
        approvedDraft: scan.draft,
        scan,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
});
