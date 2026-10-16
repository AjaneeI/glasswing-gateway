import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { authenticate } from '../../app/auth/actions';
import { requireOwner } from '../../lib/api/auth';
import { createScanRoute } from '../../lib/api/scan-route';
import { readJson } from '../../lib/gateway/api';
import { intakeRequest, buyersRequest } from '../../lib/agent/request-schemas';
import { executeTool } from '../../lib/agent/tools';
import { runAgentScan } from '../../lib/agent/loop';
import { buildIntakeContext } from '../../lib/agent/intake';
import { GatewayService } from '../../lib/gateway/service';
import { FileStore } from '../../lib/gateway/store';
import { withExecutionBudget, reserveModelCall } from '../../lib/gateway/budget';
import { OpenAIProvider } from '../../lib/gateway/provider';
import { summarySchema, type Action } from '../../lib/gateway/schemas';
import { StorefrontBrowser, validateAction } from '../../lib/gateway/browser';
import type { TestEnvironment } from '../../lib/gateway/config';
import { GatewayError } from '../../lib/gateway/errors';

test.describe.configure({ mode: 'default' });
let directory: string;
let saved: NodeJS.ProcessEnv;
test.beforeEach(async () => {
  saved = { ...process.env };
  directory = await mkdtemp(join(tmpdir(), 'gateway-publication-security-'));
  Object.assign(process.env, {
    GATEWAY_LIVE_OWNER_IDS: 'permitted-owner,second-owner',
    GATEWAY_DAILY_OWNER_USD: '10',
    GATEWAY_DAILY_GLOBAL_USD: '10',
    GATEWAY_OPERATION_USD: '10',
    GATEWAY_DAILY_OWNER_JOBS: '20',
    GATEWAY_DAILY_GLOBAL_JOBS: '100',
    GATEWAY_DAILY_OWNER_CALLS: '150',
    GATEWAY_DAILY_GLOBAL_CALLS: '500',
    GATEWAY_MODEL_PRICING: JSON.stringify({
      'gpt-6-luna': { inputPerMillion: 1, outputPerMillion: 2 },
    }),
  });
});
test.afterEach(async () => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  await rm(directory, { recursive: true, force: true });
});
const admitted = <T>(run: () => Promise<T>, owner = 'permitted-owner') =>
  withExecutionBudget(owner, false, run, directory);
const ledgerPath = () =>
  join(directory, 'execution-limits', `${new Date().toISOString().slice(0, 10)}.json`);
const ledger = async () => JSON.parse(await readFile(ledgerPath(), 'utf8'));
const request = (body: unknown, headers = {}) =>
  new Request('https://gateway.test/api/intake', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });

test('missing auth configuration fails closed in middleware, route auth, and sign-in without disabling the public shell', async () => {
  for (const name of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ])
    delete process.env[name];
  for (const path of ['/api/intake', '/api/buyers', '/api/gateway/drafts', '/api/seo']) {
    const response = await middleware(new NextRequest(`https://gateway.test${path}`));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect((await middleware(new NextRequest('https://gateway.test/discover'))).status).toBe(200);
  expect(
    (await middleware(new NextRequest('https://gateway.test/dashboard'))).headers.get('location'),
  ).toBe('https://gateway.test/login');
  await expect(requireOwner()).rejects.toMatchObject({ status: 401 });
  const form = new FormData();
  form.set('email', 'fixture@example.test');
  form.set('password', 'not-a-real-password');
  const result = await authenticate('signin', form);
  expect(result.success).not.toBe(true);
  expect(result.error).toContain('not configured');
});

test('legacy reports require verified auth and remain immutable across owners and attempted POSTs', async () => {
  let owner = 'a';
  const initial = { scanId: 'fixture', count: 1, items: ['original'] };
  const route = createScanRoute(initial, ['count'], 'items', async () => owner);
  initial.items.push('mutated-after-construction');
  const before = await route.GET();
  expect(before.headers.get('x-gateway-evidence-mode')).toBe('fixture');
  expect(await before.json()).toEqual({ scanId: 'fixture', count: 1, items: ['original'] });
  const post = await route.POST();
  expect(post.status).toBe(405);
  expect(post.headers.get('allow')).toBe('GET');
  owner = 'b';
  expect(await (await route.GET()).json()).toEqual({
    scanId: 'fixture',
    count: 1,
    items: ['original'],
  });
  const blocked = createScanRoute(initial, ['count'], 'items', async () => {
    throw new GatewayError('AUTHENTICATION_REQUIRED', 'Authentication required.', 401);
  });
  expect((await blocked.GET()).status).toBe(401);
  expect((await blocked.POST()).status).toBe(401);
});

test('legacy request schemas reject unknown fields and excessive input while accepting bounded requests', async () => {
  expect(await readJson(request({ query: 'inspect this shop' }), intakeRequest)).toEqual({
    query: 'inspect this shop',
  });
  expect(await readJson(request({ provider: 'openai' }), buyersRequest)).toEqual({
    provider: 'openai',
  });
  await expect(
    readJson(request({ query: 'ok', arbitrary: true }), intakeRequest),
  ).rejects.toThrow();
  await expect(
    readJson(request({ provider: 'arbitrary-provider' }), buyersRequest),
  ).rejects.toThrow();
  await expect(readJson(request({ query: 'x'.repeat(4001) }), intakeRequest)).rejects.toThrow();
  await expect(readJson(request('x'.repeat(128001)), intakeRequest)).rejects.toMatchObject({
    status: 413,
  });
  await expect(
    readJson(request('{}', { 'Content-Length': '128001' }), intakeRequest),
  ).rejects.toMatchObject({ status: 413 });
  await expect(readJson(request('{broken'), intakeRequest)).rejects.toMatchObject({
    code: 'INVALID_JSON',
  });
  await expect(
    readJson(request('{}', { 'Content-Type': 'text/plain' }), intakeRequest),
  ).rejects.toMatchObject({ status: 415 });
  await expect(
    readJson(request('{}', { 'Content-Type': 'text/plain; application/json' }), intakeRequest),
  ).rejects.toMatchObject({ status: 415 });
});

test('a refused reservation closes the current operation but not a later valid admission', async () => {
  await admitted(async () => {
    await expect(reserveModelCall('gpt-6-luna', 'x'.repeat(100001), 10)).rejects.toMatchObject({
      status: 413,
    });
    await expect(reserveModelCall('gpt-6-luna', '{}', 10)).rejects.toMatchObject({ status: 413 });
  });
  expect((await ledger()).total.calls).toBe(0);
  await admitted(() => reserveModelCall('gpt-6-luna', '{}', 10));
  expect((await ledger()).total.calls).toBe(1);
});

test('maximum-length valid intake goals remain valid at the buyer boundary', async () => {
  const { query } = intakeRequest.parse({ query: 'a'.repeat(4000) });
  const context = await buildIntakeContext(query);
  expect(buyersRequest.parse({ context }).context?.goals[0]).toBe(query);
});

test('legacy live responses and model tool context explicitly identify synthetic evidence', async () => {
  Object.assign(process.env, {
    GATEWAY_MODEL_MODE: 'openai',
    CUSTOM_LLM_BASE_URL: 'https://mock-provider.test/v1',
    CUSTOM_LLM_API_KEY: 'test-only',
    CUSTOM_LLM_MODEL: 'gpt-6-luna',
  });
  const transport = globalThis.fetch;
  const sent: string[] = [];
  globalThis.fetch = async (_url, options) => {
    sent.push(String(options?.body));
    const name = sent.length === 1 ? 'search_products' : 'submit_report';
    const args =
      sent.length === 1
        ? { query: 'backpack' }
        : { summary: 'Synthetic catalog inspected', success: true, findings: [] };
    return Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: String(sent.length),
                type: 'function',
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const result = await admitted(() =>
      runAgentScan('Inspect catalog', 'Test buyer', 'custom', 'https://merchant.test/'),
    );
    expect(result.mode).toBe('live-llm');
    expect(result.evidenceMode).toBe('mixed-live-and-fixture');
    expect(result.evaluationMode).toBe('shopper-self-report');
    expect(result.steps[0].evidenceMode).toBe('fixture');
    expect(result.summary).toContain('synthetic fixtures');
    expect(sent[1]).toContain('evidenceMode');
    expect(
      JSON.parse(sent[1]).messages.some(
        (m: { role: string; content: string }) =>
          m.role === 'tool' && JSON.parse(m.content).evidenceMode === 'fixture',
      ),
    ).toBe(true);
  } finally {
    globalThis.fetch = transport;
  }
});

test('persisted scan creation consumes the same durable quota before allocating another artifact', async () => {
  process.env.GATEWAY_MODEL_MODE = 'fixture';
  process.env.GATEWAY_DAILY_OWNER_JOBS = '2';
  await storefront(
    (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(productPage());
    },
    async (origin, env) => {
      const service = new GatewayService(new FileStore(directory));
      const draft = await service.inspect('artifact-owner', {
        merchantUrl: origin + '/product',
        environmentId: env.id,
      });
      const approved = await service.review('artifact-owner', draft.id, {
        revision: draft.revision,
        archetypes: draft.archetypes,
        scenarios: draft.scenarios,
        approved: true,
      });
      const input = { draftId: draft.id, revision: approved.revision };
      await service.createScan('artifact-owner', input);
      await expect(service.createScan('artifact-owner', input)).rejects.toMatchObject({
        code: 'EXECUTION_LIMIT',
        status: 429,
      });
      expect(await service.store.listScans('artifact-owner')).toHaveLength(1);
    },
  );
});

async function storefront<T>(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (origin: string, env: TestEnvironment) => Promise<T>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const env: TestEnvironment = {
    id: 'security-fixture',
    origin,
    allowedPathPrefixes: ['/', '/product', '/redirect', '/oversize', '/search'],
    searchPath: '/search',
    searchQueryParam: 'q',
    allowLoopback: true,
  };
  process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify([env]);
  try {
    return await run(origin, env);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}

test('legacy fetch uses configured pinned origins, rejects redirects and oversized bodies, and preserves permitted reads', async () => {
  const seen: string[] = [];
  await storefront(
    (req, res) => {
      seen.push(req.url || '');
      if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/secret' });
        res.end();
      } else if (req.url === '/oversize') res.end('x'.repeat(4_000_001));
      else res.end('Authorized storefront content');
    },
    async (origin) => {
      expect((await executeTool('fetch_page', { url: `${origin}/product` })).observation).toContain(
        'Authorized storefront content',
      );
      expect(
        (await executeTool('fetch_page', { url: `${origin}/redirect` })).observation,
      ).toContain('redirects are blocked');
      expect(
        (await executeTool('fetch_page', { url: `${origin}/oversize` })).observation,
      ).toContain('4 MB');
      for (const url of [
        'http://169.254.169.254/latest/meta-data/',
        'https://unconfigured.example.test/',
        `${origin}/product?delete=true`,
        `${origin.replace('http://', 'http://u:p@')}/product`,
      ])
        expect((await executeTool('fetch_page', { url })).observation).toContain('Fetch failed');
      expect(seen).toEqual(['/product', '/redirect', '/oversize']);
      process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify([
        {
          id: 'forbidden-private',
          origin,
          allowedPathPrefixes: ['/product'],
          searchPath: '/search',
          searchQueryParam: 'q',
          allowLoopback: false,
        },
      ]);
      expect((await executeTool('fetch_page', { url: `${origin}/product` })).observation).toContain(
        'prohibited',
      );
    },
  );
});

test('legacy fixture results require explicit fixture mode and are labeled; missing live configuration never becomes scripted success', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GATEWAY_MODEL_MODE;
  await expect(
    runAgentScan('Find a backpack under $100', 'Fixture buyer', 'openai'),
  ).rejects.toMatchObject({ status: 503 });
  process.env.GATEWAY_MODEL_MODE = 'fixture';
  const result = await runAgentScan('Find a backpack under $100', 'Fixture buyer', 'openai');
  expect(result.mode).toBe('scripted');
  expect(result.model).toBeNull();
  expect(result.steps.length).toBeGreaterThan(0);
});

test('environment policy changes invalidate both approved drafts and queued scans before execution', async () => {
  process.env.GATEWAY_MODEL_MODE = 'fixture';
  await storefront(
    (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(productPage());
    },
    async (origin, env) => {
      const service = new GatewayService(new FileStore(directory));
      const draft = await service.inspect('policy-owner', {
        merchantUrl: `${origin}/product`,
        environmentId: env.id,
      });
      expect(draft.environmentPolicy).toMatch(/^[a-f0-9]{64}$/);
      expect(draft.checkoutEnabled).toBe(false);
      const approved = await service.review('policy-owner', draft.id, {
        revision: draft.revision,
        archetypes: draft.archetypes,
        scenarios: draft.scenarios,
        approved: true,
      });
      const scan = await service.createScan('policy-owner', {
        draftId: draft.id,
        revision: approved.revision,
      });
      process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify([
        { ...env, checkout: { enabled: true, pathPrefixes: ['/cart', '/checkout'] } },
      ]);
      await expect(
        service.createScan('policy-owner', { draftId: draft.id, revision: approved.revision }),
      ).rejects.toMatchObject({ code: 'ENVIRONMENT_CHANGED', status: 409 });
      await expect(service.runScan('policy-owner', scan.id)).rejects.toMatchObject({
        code: 'ENVIRONMENT_CHANGED',
        status: 409,
      });
      expect((await service.store.get('scan', 'policy-owner', scan.id)).status).toBe('queued');
      process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify([env]);
      const historical = { ...approved, environmentPolicy: undefined, checkoutEnabled: undefined };
      await service.store.save('draft', historical);
      await expect(
        service.createScan('policy-owner', { draftId: draft.id, revision: approved.revision }),
      ).rejects.toMatchObject({ code: 'ENVIRONMENT_CHANGED' });
    },
  );
});

test('live model execution requires explicit owner entitlement and pricing; fixture execution cannot spend', async () => {
  let ran = false;
  await expect(
    admitted(async () => {
      ran = true;
    }, 'unapproved-owner'),
  ).rejects.toMatchObject({ status: 403 });
  expect(ran).toBe(false);
  await expect(reserveModelCall('gpt-6-luna', '{}', 10)).rejects.toMatchObject({ status: 403 });
  await expect(
    withExecutionBudget(
      'fixture-owner',
      true,
      () => reserveModelCall('gpt-6-luna', '{}', 10),
      directory,
    ),
  ).rejects.toMatchObject({ status: 403 });
  process.env.GATEWAY_MODEL_PRICING = '{}';
  await expect(admitted(() => reserveModelCall('gpt-6-luna', '{}', 10))).rejects.toMatchObject({
    status: 503,
  });
  expect((await ledger()).total.calls).toBe(0);
});

test('durable global admission blocks another owner and stale crash locks without silently expiring them', async () => {
  await admitted(async () => {
    await expect(admitted(async () => {}, 'second-owner')).rejects.toMatchObject({ status: 429 });
  });
  await admitted(async () => {}, 'second-owner');
  expect((await ledger()).total.jobs).toBe(2);
  await mkdir(join(directory, 'execution-limits', 'active.lock'));
  await expect(admitted(async () => {})).rejects.toMatchObject({ status: 429 });
});

test('concurrent reservations are serialized and daily limits survive new admissions and failures', async () => {
  process.env.GATEWAY_DAILY_OWNER_CALLS = '1';
  const result = await admitted(() =>
    Promise.allSettled([
      reserveModelCall('gpt-6-luna', '{}', 10),
      reserveModelCall('gpt-6-luna', '{}', 10),
    ]),
  );
  expect(result.map((item) => item.status)).toEqual(['fulfilled', 'rejected']);
  expect((await ledger()).total.calls).toBe(1);
  await expect(admitted(() => reserveModelCall('gpt-6-luna', '{}', 10))).rejects.toMatchObject({
    status: 429,
  });
  await admitted(() => reserveModelCall('gpt-6-luna', '{}', 10), 'second-owner');
  expect((await ledger()).total.calls).toBe(2);
  process.env.GATEWAY_DAILY_GLOBAL_CALLS = '2';
  await expect(
    admitted(() => reserveModelCall('gpt-6-luna', '{}', 10), 'second-owner'),
  ).rejects.toMatchObject({ status: 429 });
});

test('spending, request size, and daily job limits fail before transport and corrupt ledgers fail closed', async () => {
  process.env.GATEWAY_OPERATION_USD = '0.000001';
  await expect(admitted(() => reserveModelCall('gpt-6-luna', '{}', 10))).rejects.toMatchObject({
    status: 429,
  });
  expect((await ledger()).total.calls).toBe(0);
  process.env.GATEWAY_OPERATION_USD = '10';
  await expect(
    admitted(() => reserveModelCall('gpt-6-luna', 'x'.repeat(100001), 10)),
  ).rejects.toMatchObject({ status: 413 });
  process.env.GATEWAY_DAILY_OWNER_JOBS = '2';
  await expect(admitted(async () => {})).rejects.toMatchObject({ status: 429 });
  await writeFile(ledgerPath(), '{corrupt');
  await expect(admitted(async () => {}, 'second-owner')).rejects.toThrow();
});

test('provider reserves every retry before mocked transport; unknown failed charges remain reserved', async () => {
  process.env.GATEWAY_MODEL_MODE = 'openai';
  process.env.OPENAI_API_KEY = 'fixture-not-a-real-key';
  let calls = 0;
  const provider = new OpenAIProvider(async () => {
    calls++;
    expect((await ledger()).total.calls).toBe(calls);
    if (calls === 1) throw new Error('Unknown transport outcome');
    return Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '{"title":"Fixture","summary":"Mocked provider response"}',
            },
          ],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });
  const result = await admitted(() =>
    provider.generate('summary', summarySchema, '', {}, async () => {}),
  );
  expect(result.title).toBe('Fixture');
  expect(calls).toBe(2);
  expect((await ledger()).total.calls).toBe(2);
  expect((await ledger()).total.reservedUsd).toBeGreaterThan(0);
});

test('owner and global spending limits independently constrain later executions and global jobs constrain other owners', async () => {
  await admitted(() => reserveModelCall('gpt-6-luna', '{}', 10));
  const reserved = (await ledger()).total.reservedUsd;
  process.env.GATEWAY_DAILY_OWNER_USD = String(reserved + 0.000001);
  await expect(admitted(() => reserveModelCall('gpt-6-luna', '{}', 10))).rejects.toMatchObject({
    status: 429,
  });
  process.env.GATEWAY_DAILY_OWNER_USD = '10';
  process.env.GATEWAY_DAILY_GLOBAL_USD = String(reserved + 0.000001);
  await expect(
    admitted(() => reserveModelCall('gpt-6-luna', '{}', 10), 'second-owner'),
  ).rejects.toMatchObject({ status: 429 });
  expect((await ledger()).total.calls).toBe(1);
  process.env.GATEWAY_DAILY_GLOBAL_JOBS = '3';
  await expect(admitted(async () => {}, 'second-owner')).rejects.toMatchObject({ status: 429 });
});

function action(type: Action['type'], url: string | null = null): Action {
  return {
    type,
    url,
    query: null,
    disposition: null,
    productObservationId: null,
    reason: 'Security fixture action',
  };
}
function productPage(script = '') {
  return `<html><body><h1>Fixture product</h1><script type="application/ld+json">{"@type":"Product","name":"Fixture product","offers":{"price":12,"priceCurrency":"USD"}}</script><form action="/cart/add.js" method="post"><input name="id" value="123"></form>${script}</body></html>`;
}

test('checkout scripts cannot mutate on load or input; exact inspected cart addition remains functional', async () => {
  const posts: { url: string; body: string }[] = [];
  let mutationGets = 0;
  await storefront(
    (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      if (req.method === 'GET' && req.url === '/cart/add.js') mutationGets++;
      if (req.method !== 'GET') {
        let body = '';
        req.on('data', (data) => (body += data));
        req.on('end', () => {
          posts.push({ url: req.url || '', body });
          res.end('{}');
        });
        return;
      }
      if (req.url === '/product')
        res.end(
          productPage(
            `<script>fetch('/cart/add.js',{method:'POST',body:'id=999&quantity=20'}).catch(()=>{});fetch('/checkout/process',{method:'POST'}).catch(()=>{});fetch('/cart/add.js').catch(()=>{});</script>`,
          ),
        );
      else if (req.url === '/cart')
        res.end('<html><body><a href="/checkout">Checkout</a></body></html>');
      else
        res.end(
          '<html><body><input name="email" oninput="fetch(\'/checkout\',{method:\'POST\',body:this.value}).catch(()=>{})"></body></html>',
        );
    },
    async (origin, base) => {
      const env = {
        ...base,
        checkout: {
          enabled: true,
          pathPrefixes: ['/cart', '/checkout'],
          cartAddPath: '/cart/add.js' as const,
        },
      };
      const browser = await StorefrontBrowser.open(env, AbortSignal.timeout(20_000));
      try {
        await expect(browser.execute(action('add_to_cart', `${origin}/product`))).rejects.toThrow(
          'Inspect',
        );
        const observed = await browser.observe(`${origin}/product`, 'product');
        expect(posts).toEqual([]);
        expect(mutationGets).toBe(0);
        const scenario = { permittedActions: ['add_to_cart'] } as Parameters<
          typeof validateAction
        >[1];
        expect(() =>
          validateAction(action('add_to_cart', `${origin}/product/unseen`), scenario, env, [
            observed,
          ]),
        ).toThrow('previously inspected');
        expect(() =>
          validateAction(action('add_to_cart', `${origin}/product`), scenario, env, [observed]),
        ).not.toThrow();
        await browser.execute(action('add_to_cart', `${origin}/product`));
        expect(posts).toEqual([{ url: '/cart/add.js', body: 'id=123&quantity=1' }]);
        await browser.execute(action('begin_checkout'));
        await browser.execute(action('fill_checkout'));
        expect(posts).toHaveLength(1);
      } finally {
        await browser.close();
      }
    },
  );
});

for (const attack of [
  { label: 'substituted body', fetch: "originalFetch(url,{...options,body:'id=999&quantity=9'})" },
  { label: 'substituted endpoint', fetch: "originalFetch('/cart/change.js',options)" },
])
  test(`cart grant refuses a page-script ${attack.label}`, async () => {
    let posts = 0;
    await storefront(
      (req, res) => {
        if (req.method !== 'GET') posts++;
        res.setHeader('Content-Type', 'text/html');
        res.end(
          productPage(
            `<script>const originalFetch=window.fetch;window.fetch=(url,options)=>${attack.fetch};</script>`,
          ),
        );
      },
      async (origin, base) => {
        const env = {
          ...base,
          checkout: {
            enabled: true,
            pathPrefixes: ['/cart', '/checkout'],
            cartAddPath: '/cart/add.js' as const,
          },
        };
        const browser = await StorefrontBrowser.open(env, AbortSignal.timeout(20_000));
        try {
          await browser.observe(`${origin}/product`, 'product');
          await expect(
            browser.execute(action('add_to_cart', `${origin}/product`)),
          ).rejects.toThrow();
          expect(posts).toBe(0);
        } finally {
          await browser.close();
        }
      },
    );
  });

test('one reviewed cart action authorizes only one exact request even when a page script duplicates it', async () => {
  const posts: string[] = [];
  await storefront(
    (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (data) => (body += data));
        req.on('end', () => {
          posts.push(body);
          res.end('{}');
        });
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(
        productPage(
          `<script>const originalFetch=window.fetch;window.fetch=async(url,options)=>{const results=await Promise.allSettled([originalFetch(url,options),originalFetch(url,options)]);return results.find(result=>result.status==='fulfilled').value;};</script>`,
        ),
      );
    },
    async (origin, base) => {
      const env = {
        ...base,
        checkout: {
          enabled: true,
          pathPrefixes: ['/cart', '/checkout'],
          cartAddPath: '/cart/add.js' as const,
        },
      };
      const browser = await StorefrontBrowser.open(env, AbortSignal.timeout(20_000));
      try {
        await browser.observe(`${origin}/product`, 'product');
        await browser.execute(action('add_to_cart', `${origin}/product`));
        expect(posts).toEqual(['id=123&quantity=1']);
      } finally {
        await browser.close();
      }
    },
  );
});
