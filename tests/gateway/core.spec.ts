import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { GatewayService, gatewayService, validatePlan } from '../../lib/gateway/service';
import { FileStore } from '../../lib/gateway/store';
import { withExecutionBudget } from '../../lib/gateway/budget';

async function admittedMockProvider<T>(run: () => Promise<T>) {
  const budgetDirectory = await mkdtemp(join(tmpdir(), 'gateway-mock-provider-'));
  const keys = [
    'GATEWAY_LIVE_OWNER_IDS',
    'GATEWAY_DAILY_OWNER_USD',
    'GATEWAY_DAILY_GLOBAL_USD',
    'GATEWAY_OPERATION_USD',
    'GATEWAY_MODEL_PRICING',
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    GATEWAY_LIVE_OWNER_IDS: 'mock-provider-owner',
    GATEWAY_DAILY_OWNER_USD: '10',
    GATEWAY_DAILY_GLOBAL_USD: '10',
    GATEWAY_OPERATION_USD: '10',
    GATEWAY_MODEL_PRICING: JSON.stringify({
      'gpt-6-luna': { inputPerMillion: 1, outputPerMillion: 2 },
    }),
  });
  try {
    return await withExecutionBudget('mock-provider-owner', false, run, budgetDirectory);
  } finally {
    for (const key of keys)
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    await rm(budgetDirectory, { recursive: true, force: true });
  }
}

test('hot reload replaces an unversioned cached runner and reuses the current runner', () => {
  const cache = globalThis as typeof globalThis & {
    gatewayService?: GatewayService;
    gatewayServiceVersion?: number;
  };
  const previous = cache.gatewayService;
  const previousVersion = cache.gatewayServiceVersion;
  try {
    const stale = new GatewayService();
    cache.gatewayService = stale;
    delete cache.gatewayServiceVersion;
    const current = gatewayService();
    expect(current).not.toBe(stale);
    expect(gatewayService()).toBe(current);
  } finally {
    cache.gatewayService = previous;
    cache.gatewayServiceVersion = previousVersion;
  }
});
import {
  allowedUrl,
  safeAddress,
  StorefrontBrowser,
  validateAction,
} from '../../lib/gateway/browser';
import { environment } from '../../lib/gateway/config';
import { OpenAIProvider } from '../../lib/gateway/provider';
import { testIdentity, valueForField } from '../../lib/gateway/test-identity';
import {
  actionSchema,
  summarySchema,
  type Action,
  type Draft,
  type ModelCall,
  type Observation,
  type Scenario,
} from '../../lib/gateway/schemas';
import { deterministicChecks, evaluate } from '../../lib/gateway/evaluate';
import { handleGateway } from '../../lib/gateway/api';
import { GatewayError } from '../../lib/gateway/errors';

test.describe.configure({ mode: 'serial' });
let server: Server;
let origin: string;
let directory: string;
let service: GatewayService;
let draft: Draft;
let mutations = 0;
let leakedCookies = 0;
const previous = { ...process.env };
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'gateway-tests-'));
  server = createServer((request, response) => {
    if (request.method !== 'GET') mutations++;
    if (request.url === '/' && request.headers.cookie) leakedCookies++;
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Set-Cookie', 'shopper=isolated; Path=/');
    if (request.url === '/products/navigation-heavy') {
      response.end(
        `<html><body>${'<a href="/">Menu</a>'.repeat(150)}<a href="/products/pack">Trail Pack</a></body></html>`,
      );
      return;
    }
    if (request.url?.startsWith('/products/aggregate')) {
      response.end(
        `<html><body><h1>Juice</h1><script type="application/ld+json">${JSON.stringify({
          '@type': 'Product',
          name: 'Juice',
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: 1.99,
            highPrice: request.url.endsWith('-range') ? 3.99 : 1.99,
            priceCurrency: 'USD',
          },
        })}</script></body></html>`,
      );
      return;
    }
    if (request.url?.startsWith('/products/variants')) {
      response.end(
        `<html><body><h1>Variant pack</h1><script type="application/ld+json">${JSON.stringify({
          '@type': 'ProductGroup',
          hasVariant: ['blue', 'red'].map((variant, index) => ({
            '@type': 'Product',
            name: `${variant} pack`,
            offers: {
              price: 20 + index,
              priceCurrency: 'USD',
              url: `${origin}/products/variants?variant=${variant}`,
            },
          })),
        })}</script></body></html>`,
      );
      return;
    }
    if (request.url?.startsWith('/products/pack')) {
      response.end(
        `<html><title>Trail Pack</title><body><h1>Trail Pack</h1><p>Blue hiking backpack. Price: $89 USD.</p><script type="application/ld+json">{"@type":"Product","name":"Trail Pack","offers":{"price":"89","priceCurrency":"USD"}}</script><a href="/">Home</a></body></html>`,
      );
    } else
      response.end(
        `<html><title>Trail Store</title><body><h1>Hiking gear</h1><a href="/products/pack">Trail Pack</a><a href="http://169.254.169.254/latest/meta-data/">Unsafe</a><a href="/checkout">Checkout</a><script>fetch('/orders',{method:'POST'}).catch(()=>{});</script></body></html>`,
      );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify([
    {
      id: 'test',
      origin,
      allowedPathPrefixes: ['/', '/products', '/search'],
      searchPath: '/search',
      searchQueryParam: 'q',
      allowLoopback: true,
    },
  ]);
  process.env.GATEWAY_MODEL_MODE = 'fixture';
  const local = join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
  if (existsSync(local)) process.env.GATEWAY_CHROMIUM_PATH = local;
  service = new GatewayService(new FileStore(directory));
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(directory, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
});

test('browser restricts URLs, credentials, mutation queries, and private network destinations', async () => {
  const env = environment('test');
  expect(allowedUrl(`${origin}/products/pack`, env)).toBe(`${origin}/products/pack`);
  for (const url of [
    'http://169.254.169.254/',
    `${origin}/checkout`,
    `${origin}/products/pack?delete=true`,
    `${origin}/products/%252e%252e/checkout`,
    `${origin.replace('http://', 'http://user:pass@')}/`,
  ])
    expect(() => allowedUrl(url, env)).toThrow();
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
  ])
    expect(safeAddress(address, false)).toBe(false);
  expect(safeAddress('127.0.0.1', true)).toBe(true);
  expect(safeAddress('10.0.0.1', true)).toBe(false);
  expect(safeAddress('8.8.8.8', false)).toBe(true);
  await expect(
    StorefrontBrowser.open({ ...env, allowLoopback: false }, AbortSignal.timeout(5000)),
  ).rejects.toThrow('prohibited');
});

test('checkout paths open only for an environment that opted in, and never the dangerous ones', () => {
  const readOnly = environment('test');
  const checkoutEnabled = {
    ...readOnly,
    checkout: { enabled: true, pathPrefixes: ['/cart', '/checkout'] },
  };

  // Opting in must not be a way to reach an account, the admin surface, an
  // existing order, or a payment page. These stay blocked either way.
  for (const path of ['/account', '/account/login', '/admin', '/orders/1234', '/payments']) {
    expect(() => allowedUrl(`${origin}${path}`, readOnly)).toThrow();
    expect(() => allowedUrl(`${origin}${path}`, checkoutEnabled)).toThrow();
  }

  // Cart and checkout are blocked by default and reachable once opted in.
  for (const path of ['/cart', '/checkout']) {
    expect(() => allowedUrl(`${origin}${path}`, readOnly)).toThrow();
    expect(allowedUrl(`${origin}${path}`, checkoutEnabled)).toBe(`${origin}${path}`);
  }

  // Opting in does not exempt checkout from explicit read-only query rules.
  expect(() =>
    allowedUrl(`${origin}/checkout/abc?step=contact_information`, checkoutEnabled),
  ).toThrow();
  const permittedQuery = {
    ...checkoutEnabled,
    readOnlyQueryRules: [{ pathPrefix: '/checkout', names: ['step'] }],
  };
  expect(allowedUrl(`${origin}/checkout/abc?step=contact_information`, permittedQuery)).toContain(
    'step=contact_information',
  );
  expect(() =>
    allowedUrl(`${origin}/products/pack?step=contact_information`, checkoutEnabled),
  ).toThrow();

  // Opting in never widens the origin.
  expect(() => allowedUrl('https://evil.example.com/cart', checkoutEnabled)).toThrow();
});

test('repeated navigation links do not hide product links from shopper observations', async () => {
  const browser = await StorefrontBrowser.open(environment('test'), AbortSignal.timeout(20_000));
  try {
    const observation = await browser.observe(`${origin}/products/navigation-heavy`);
    expect(observation.links.filter((link) => link.url === `${origin}/`)).toHaveLength(1);
    expect(observation.links.some((link) => link.url === `${origin}/products/pack`)).toBe(true);
  } finally {
    await browser.close();
  }
});

test('the checkout shopper can never supply a payment or billing value', () => {
  // J Skis, like most Shopify stores, uses a one-page checkout: contact,
  // delivery and card fields all live on the same page. Safety therefore
  // cannot come from refusing the page — it has to come from the field map
  // being incapable of producing a value for a field we must not touch.
  const forbidden = [
    'cardNumber',
    'number',
    'credit-card',
    'cc-number',
    'cvv',
    'cvc',
    'security_code',
    'expiry',
    'exp-month',
    'exp_year',
    'billing_address1',
    'billingAddress',
    'billing-zip',
    'payment_method',
  ];
  for (const descriptor of forbidden) expect(valueForField(descriptor)).toBeNull();

  // The delivery fields it is allowed to fill still work.
  expect(valueForField('firstName')).toBe('John');
  expect(valueForField('lastName')).toBe('Doe');
  expect(valueForField('address1')).toBe('123 Appleseed Lane');
  expect(valueForField('city')).toBe('Los Gatos');
  expect(valueForField('zip')).toBe('95030');

  // Nothing in the identity is card-shaped, so a missed field cannot leak one.
  for (const value of Object.values(testIdentity))
    if (typeof value === 'string') expect(/^\d{12,19}$/.test(value.replace(/\s/g, ''))).toBe(false);
});

test('read-only query rules are scoped and attribution is removed before navigation', () => {
  const env = {
    ...environment('test'),
    readOnlyQueryRules: [{ pathPrefix: '/products', names: ['cursor', 'direction', 'variant'] }],
  };
  expect(allowedUrl(`${origin}/?utm_source=chatgpt.com`, env)).toBe(`${origin}/`);
  expect(allowedUrl(`${origin}/products?cursor=abc&direction=next`, env)).toContain('cursor=abc');
  expect(() => allowedUrl(`${origin}/?cursor=abc`, env)).toThrow();
  expect(() => allowedUrl(`${origin}/products?cursor=abc&delete=true`, env)).toThrow();
  expect(() => allowedUrl(`${origin}/products/checkout?variant=blue`, env)).toThrow();
});

test('product group variants are discovered and a selected variant retains only its own price', async () => {
  const env = {
    ...environment('test'),
    readOnlyQueryRules: [{ pathPrefix: '/products', names: ['variant'] }],
  };
  const browser = await StorefrontBrowser.open(env, AbortSignal.timeout(20_000));
  try {
    const group = await browser.observe(`${origin}/products/variants`, 'product');
    expect(group.products).toHaveLength(2);
    expect(group.links.map((link) => link.url)).toContain(
      `${origin}/products/variants?variant=red`,
    );
    const red = await browser.observe(`${origin}/products/variants?variant=red`, 'product');
    expect(red.products).toEqual([{ name: 'red pack', price: 21, currency: 'USD' }]);
    const unknown = await browser.observe(`${origin}/products/variants?variant=unknown`, 'product');
    expect(unknown.products).toEqual([]);
  } finally {
    await browser.close();
  }
});

test('aggregate offers yield an exact price only when both bounds agree', async () => {
  const browser = await StorefrontBrowser.open(environment('test'), AbortSignal.timeout(20_000));
  try {
    const exact = await browser.observe(`${origin}/products/aggregate`, 'product');
    expect(exact.products[0].price).toBe(1.99);
    const range = await browser.observe(`${origin}/products/aggregate-range`, 'product');
    expect(range.products[0].price).toBeNull();
  } finally {
    await browser.close();
  }
});

test('inspection creates evidence-backed fixture hypotheses and a reviewable three-mode plan', async () => {
  test.setTimeout(60_000);
  draft = await service.inspect('merchant-a', { merchantUrl: origin, environmentId: 'test' });
  expect(draft.fixture).toBe(true);
  expect(draft.evidence.length).toBeGreaterThan(1);
  expect(draft.approvedAt).toBeNull();
  expect(new Set(draft.scenarios.map((scenario) => scenario.mode)).size).toBe(3);
  expect(draft.scenarios.some((scenario) => scenario.expectedOutcome === 'decline')).toBe(true);
  expect(draft.modelCalls).toHaveLength(3);
  expect(
    draft.modelCalls.every(
      (call) => call.fixture && call.model.startsWith('fixture:') && call.promptVersion,
    ),
  ).toBe(true);
  expect(
    draft.evidence[0].links.every(
      (link) => link.url.startsWith(origin) && !link.url.includes('checkout'),
    ),
  ).toBe(true);
  await expect(
    service.createScan('merchant-a', { draftId: draft.id, revision: draft.revision }),
  ).rejects.toThrow('Approve');
  await expect(service.store.get('draft', 'merchant-b', draft.id)).rejects.toThrow('not found');
});

test('review validates provenance and optimistic revisions, and records merchant edits', async () => {
  const invalid = structuredClone(draft.scenarios);
  invalid[0].provenance.evidenceIds = ['fabricated'];
  expect(() => validatePlan(draft.archetypes, invalid, draft.evidence)).toThrow('evidence');
  const archetypes = structuredClone(draft.archetypes);
  archetypes[0].patience = 'low';
  draft = await service.review('merchant-a', draft.id, {
    revision: draft.revision,
    archetypes,
    scenarios: draft.scenarios,
    approved: true,
  });
  expect(draft.archetypes[0].provenance.source).toBe('merchant_edit');
  expect(draft.approvedAt).not.toBeNull();
  await expect(
    service.review('merchant-a', draft.id, {
      revision: 1,
      archetypes,
      scenarios: draft.scenarios,
      approved: true,
    }),
  ).rejects.toThrow('Reload');
});

test('full scan runs isolated shoppers, independently evaluates decline, persists replay, and supports UI APIs', async () => {
  test.setTimeout(90_000);
  const scan = await service.createScan('merchant-a', {
    draftId: draft.id,
    revision: draft.revision,
  });
  const completed = await service.runScan('merchant-a', scan.id);
  expect(completed.status).toBe('completed');
  expect(completed.sessions.map((session) => session.evaluation?.outcome)).toEqual([
    'passed',
    'passed',
    'passed',
  ]);
  for (const session of completed.sessions) {
    expect(session.trace.length).toBeGreaterThanOrEqual(3);
    expect(session.modelCalls.some((call) => call.purpose === 'evaluator')).toBe(true);
    expect(session.trace[0].detail).toContain('isolated');
  }
  expect(mutations).toBe(0);
  expect(leakedCookies).toBe(0);
  await expect(service.runScan('merchant-a', scan.id)).rejects.toThrow('runs once');
  const reloaded = await new FileStore(directory).get('scan', 'merchant-a', scan.id);
  expect(reloaded.sessions[0].trace).toEqual(completed.sessions[0].trace);
  const observed = completed.sessions[0].trace.find(
    (event) => event.observation?.screenshotAvailable,
  )!.observation!;
  const screenshotPath = `sessions/${completed.sessions[0].id}/screenshot`;
  const request = new Request(
    `http://gateway.test/api/gateway/${screenshotPath}?observation=${observed.id}`,
  );
  const image = await handleGateway(
    request,
    screenshotPath.split('/'),
    async () => 'merchant-a',
    service,
  );
  expect(image.status).toBe(200);
  expect(image.headers.get('content-type')).toBe('image/jpeg');
  expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(100);
  const otherOwner = await handleGateway(
    request,
    screenshotPath.split('/'),
    async () => 'merchant-b',
    service,
  );
  expect(otherOwner.status).toBe(404);
  const wrongObservation = await handleGateway(
    new Request(`http://gateway.test/api/gateway/${screenshotPath}?observation=not-an-observation`),
    screenshotPath.split('/'),
    async () => 'merchant-a',
    service,
  );
  expect(wrongObservation.status).toBe(404);

  for (const path of [
    'dashboard',
    'sessions',
    'findings',
    'scans',
    `scans/${scan.id}`,
    `sessions/${scan.sessions[0].id}/replay`,
  ]) {
    const response = await handleGateway(
      new Request(`http://gateway.test/api/gateway/${path}`),
      path.split('/'),
      async () => 'merchant-a',
      service,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.apiVersion).toBe('v1');
    if (path === 'dashboard') {
      expect(body.data.fixtureSessions).toBe(3);
      expect(body.data.passRate).toBeNull();
    }
    if (path.endsWith('/replay')) expect(body.data.events.length).toBeGreaterThan(0);
  }
  const response = await handleGateway(
    new Request(`http://gateway.test/api/gateway/scans/${scan.id}`),
    ['scans', scan.id],
    async () => 'merchant-b',
    service,
  );
  expect(response.status).toBe(404);
});

test('action validation rejects arbitrary scripts, unseen URLs, and unsupported recommendations', () => {
  expect(actionSchema.safeParse({ type: 'execute_script', code: 'alert(1)' }).success).toBe(false);
  const action: Action = {
    type: 'navigate',
    url: `${origin}/products/hidden`,
    query: null,
    disposition: null,
    productObservationId: null,
    reason: 'Navigate',
  };
  expect(() =>
    validateAction(action, draft.scenarios[0], environment('test'), draft.evidence),
  ).toThrow('discovered');
  expect(() =>
    validateAction(
      {
        ...action,
        type: 'stop',
        url: null,
        disposition: 'recommend',
        productObservationId: draft.evidence[0].id,
      },
      draft.scenarios[0],
      environment('test'),
      draft.evidence,
    ),
  ).toThrow('inspected');
});

test('semantic pass cannot override failed price checks or unknown evidence', async () => {
  const observation: Observation = {
    ...draft.evidence[0],
    kind: 'product',
    products: [{ name: 'Pack', price: 89, currency: 'USD' }],
  };
  const scenario: Scenario = {
    ...draft.scenarios[0],
    hardConstraints: [{ kind: 'max_price', value: '50', description: 'Maximum $50' }],
  };
  const trace = [
    {
      id: 'event',
      sequence: 0,
      timestamp: new Date().toISOString(),
      action: {
        type: 'stop' as const,
        disposition: 'recommend' as const,
        productObservationId: observation.id,
        url: null,
        query: null,
        reason: 'I succeeded',
      },
      observation,
      status: 'executed' as const,
      detail: 'Self-report',
    },
  ];
  expect(
    deterministicChecks(scenario, trace).find((check) => check.name === 'constraint_0')?.result,
  ).toBe('fail');
  const provider = new OpenAIProvider();
  expect(
    (await evaluate(scenario, trace, provider, async () => {}, AbortSignal.timeout(5000))).outcome,
  ).toBe('failed');
  const unknown = { ...observation, products: [{ name: 'Pack', price: null, currency: null }] };
  expect(
    (
      await evaluate(
        scenario,
        [{ ...trace[0], observation: unknown }],
        provider,
        async () => {},
        AbortSignal.timeout(5000),
      )
    ).outcome,
  ).toBe('inconclusive');
});

test('missing API key fails clearly; provider validates structured output and records retries, usage and costs', async () => {
  await admittedMockProvider(async () => {
    process.env.GATEWAY_MODEL_MODE = 'openai';
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIProvider()).toThrow('OPENAI_API_KEY');
    process.env.OPENAI_API_KEY = 'test-not-a-real-key';
    process.env.GATEWAY_MODEL_PRICING = JSON.stringify({
      'gpt-6-luna': { inputPerMillion: 1, outputPerMillion: 2 },
    });
    const calls: ModelCall[] = [];
    let attempts = 0;
    const provider = new OpenAIProvider(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      expect(request.text.format.strict).toBe(true);
      expect(request.model).toBe('gpt-6-luna');
      attempts++;
      if (attempts === 1) return new Response('', { status: 429 });
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: attempts === 2 ? '{"title":42}' : '{"title":"Finding","summary":"Evidence"}',
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      });
    });
    const result = await provider.generate(
      'summary',
      summarySchema,
      'Summarize',
      {},
      async (call) => {
        calls.push(call);
      },
    );
    expect(result.title).toBe('Finding');
    expect(calls[0].attempts).toBe(3);
    expect(calls[0].inputTokens).toBe(200);
    expect(calls[0].estimatedCostUsd).toBeCloseTo(0.00028);
    expect(calls[0].fixture).toBe(false);
    const invalid = new OpenAIProvider(async () =>
      Response.json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    await expect(
      invalid.generate('summary', summarySchema, '', {}, async (call) => {
        calls.push(call);
      }),
    ).rejects.toThrow('schema');
    expect(calls.at(-1)?.status).toBe('failed');
    process.env.GATEWAY_MODEL_MODE = 'fixture';
  });
});

test('API returns stable auth, JSON, CSRF, validation and configuration errors', async () => {
  const request = (body: string, extra: Record<string, string> = {}) =>
    new Request('http://gateway.test/api/gateway/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extra },
      body,
    });
  const unauthenticated = await handleGateway(
    request('{}'),
    ['drafts'],
    async () => {
      throw new GatewayError('AUTHENTICATION_REQUIRED', 'Authentication required.', 401);
    },
    service,
  );
  expect(unauthenticated.status).toBe(401);
  expect((await unauthenticated.json()).error.code).toBe('AUTHENTICATION_REQUIRED');
  expect(
    (
      await handleGateway(
        request('{}', { Origin: 'https://evil.test' }),
        ['drafts'],
        async () => 'merchant-a',
        service,
      )
    ).status,
  ).toBe(403);
  expect(
    (await handleGateway(request('{'), ['drafts'], async () => 'merchant-a', service)).status,
  ).toBe(400);
  expect(
    (await handleGateway(request('{}'), ['drafts'], async () => 'merchant-a', service)).status,
  ).toBe(400);
  const payload = JSON.stringify({ merchantUrl: origin, environmentId: 'test' });
  process.env.GATEWAY_MODEL_MODE = 'openai';
  delete process.env.OPENAI_API_KEY;
  const missing = await handleGateway(
    request(payload),
    ['drafts'],
    async () => 'merchant-a',
    service,
  );
  expect(missing.status).toBe(503);
  expect((await missing.json()).error.code).toBe('CONFIGURATION_ERROR');
  process.env.GATEWAY_MODEL_MODE = 'fixture';
});

test('interrupted scans preserve evidence and concurrent locks reject duplicate execution', async () => {
  const scan = await service.createScan('merchant-a', {
    draftId: draft.id,
    revision: draft.revision,
  });
  scan.status = 'running';
  scan.runtimeId = 'previous-process';
  scan.sessions[0].status = 'running';
  await service.store.save('scan', scan);
  const recovered = await service.store.get('scan', 'merchant-a', scan.id);
  expect(recovered.status).toBe('interrupted');
  expect(recovered.sessions.every((session) => session.status === 'interrupted')).toBe(true);
  let release!: () => void;
  const pending = service.store.exclusive(
    'same-key',
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await expect(service.store.exclusive('same-key', async () => {})).rejects.toThrow('already');
  release();
  await pending;
});

test('browser blocks redirected off-origin requests before reaching the destination', async () => {
  let hits = 0;
  const destination = createServer((_request, response) => {
    hits++;
    response.end('<body>Forbidden destination</body>');
  });
  await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
  const redirect = createServer((_request, response) => {
    response.writeHead(302, {
      Location: `http://127.0.0.1:${(destination.address() as { port: number }).port}/`,
    });
    response.end();
  });
  await new Promise<void>((resolve) => redirect.listen(0, '127.0.0.1', resolve));
  const env = {
    ...environment('test'),
    origin: `http://127.0.0.1:${(redirect.address() as { port: number }).port}`,
  };
  const browser = await StorefrontBrowser.open(env, AbortSignal.timeout(10_000));
  try {
    await expect(browser.observe(env.origin)).rejects.toThrow('redirects are blocked');
    expect(hits).toBe(0);
  } finally {
    await browser.close();
    await Promise.all([
      new Promise<void>((resolve) => redirect.close(() => resolve())),
      new Promise<void>((resolve) => destination.close(() => resolve())),
    ]);
  }
});

test('blocked shopper actions produce findings and do not stop other isolated sessions', async () => {
  test.setTimeout(60_000);
  const delegate = new OpenAIProvider();
  const provider: import('../../lib/gateway/provider').ModelProvider = {
    fixture: true,
    async generate(purpose, schema, instructions, input, record, signal) {
      if (purpose === 'shopper')
        return schema.parse({
          action: {
            type: 'navigate',
            url: `${origin}/checkout`,
            query: null,
            disposition: null,
            productObservationId: null,
            reason: 'Attempt a forbidden action.',
          },
        });
      if (purpose === 'evaluator') {
        expect(input).not.toHaveProperty('priorActions');
        expect(input.scenario).not.toHaveProperty('expectedOutcome');
        expect(JSON.stringify(input)).not.toContain('Attempt a forbidden action.');
      }
      return delegate.generate(purpose, schema, instructions, input, record, signal);
    },
  };
  const unsafeService = new GatewayService(service.store, () => provider);
  const scan = await unsafeService.createScan('merchant-a', {
    draftId: draft.id,
    revision: draft.revision,
  });
  const result = await unsafeService.runScan('merchant-a', scan.id);
  expect(result.sessions.every((session) => session.evaluation?.outcome === 'failed')).toBe(true);
  expect(result.findings).toHaveLength(3);
  expect(
    result.findings.every(
      (finding) => finding.category === 'boundary' && finding.evidenceIds.length > 0,
    ),
  ).toBe(true);
  expect(
    result.sessions.every((session) => session.trace.some((event) => event.status === 'blocked')),
  ).toBe(true);
  expect(
    (await service.store.listCalls('merchant-a')).some(
      (call) => call.operationId === scan.id && call.purpose === 'evaluator',
    ),
  ).toBe(true);
});

test('evaluator rejects invented citations, provider refuses terminal errors and handles aborted requests', async () => {
  await admittedMockProvider(async () => {
    const provider: import('../../lib/gateway/provider').ModelProvider = {
      fixture: true,
      async generate(_purpose, schema) {
        return schema.parse({
          verdict: 'pass',
          reason: 'Unsupported claim',
          evidenceIds: ['invented'],
          constraintAssessments: [],
        });
      },
    };
    const trace = [
      {
        id: 'event',
        sequence: 0,
        timestamp: new Date().toISOString(),
        action: null,
        observation: draft.evidence[0],
        status: 'observed' as const,
        detail: 'Observed',
      },
    ];
    await expect(
      evaluate(draft.scenarios[0], trace, provider, async () => {}, AbortSignal.timeout(5000)),
    ).rejects.toThrow('invalid evidence');
    process.env.GATEWAY_MODEL_MODE = 'openai';
    process.env.OPENAI_API_KEY = 'test-not-real';
    let calls = 0;
    const terminal = new OpenAIProvider(async () => {
      calls++;
      return new Response('', { status: 401 });
    });
    await expect(
      terminal.generate('summary', summarySchema, '', {}, async () => {}),
    ).rejects.toThrow('401');
    expect(calls).toBe(1);
    const abort = new AbortController();
    abort.abort();
    await expect(
      terminal.generate('summary', summarySchema, '', {}, async () => {}, abort.signal),
    ).rejects.toThrow();
    expect(calls).toBe(1);
    process.env.GATEWAY_MODEL_MODE = 'fixture';
  });
});

test('configured search and product inspection execute against browser observations', async () => {
  const browser = await StorefrontBrowser.open(environment('test'), AbortSignal.timeout(10_000));
  try {
    const search = await browser.execute({
      type: 'search',
      query: 'blue pack',
      url: null,
      disposition: null,
      productObservationId: null,
      reason: 'Search catalog',
    });
    expect(search?.url).toBe(`${origin}/search?q=blue+pack`);
    expect(search?.links.some((link) => link.url.endsWith('/products/pack'))).toBe(true);
    const product = await browser.execute({
      type: 'inspect_product',
      url: `${origin}/products/pack`,
      query: null,
      disposition: null,
      productObservationId: null,
      reason: 'Inspect result',
    });
    expect(product?.products).toEqual([{ name: 'Trail Pack', price: 89, currency: 'USD' }]);
    expect(product?.kind).toBe('product');
  } finally {
    await browser.close();
  }
});

test('saved draft listing is owner-scoped and configured public origins work behind a proxy', async () => {
  const list = await handleGateway(
    new Request('http://gateway.test/api/gateway/drafts'),
    ['drafts'],
    async () => 'merchant-a',
    service,
  );
  expect((await list.json()).data.items.some((item: { id: string }) => item.id === draft.id)).toBe(
    true,
  );
  const other = await handleGateway(
    new Request('http://gateway.test/api/gateway/drafts'),
    ['drafts'],
    async () => 'merchant-b',
    service,
  );
  expect((await other.json()).data.items).toHaveLength(0);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://gateway.public.test';
  try {
    const response = await handleGateway(
      new Request('http://internal:3000/api/gateway/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://gateway.public.test' },
        body: '{}',
      }),
      ['drafts'],
      async () => 'merchant-a',
      service,
    );
    expect(response.status).toBe(400); // Body validation, not an origin rejection.
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
  } finally {
    if (site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = site;
  }
  const oldModuleError = Object.assign(new Error('Resource not found.'), {
    name: 'GatewayError',
    code: 'NOT_FOUND',
    status: 404,
    retryable: false,
  });
  const response = await handleGateway(
    new Request('http://gateway.test/api/gateway/drafts'),
    ['drafts'],
    async () => {
      throw oldModuleError;
    },
    service,
  );
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe('NOT_FOUND');
});

test('readiness bridge persists evaluator inputs with ownership and evidence validation', async () => {
  const scan = (await service.store.listScans('merchant-a')).find(
    (s) => s.draft.id === draft.id && s.status === 'completed',
  )!;
  const path = ['scans', scan.id, 'readiness'];
  const report = {
    category: 'discovery',
    producer: 'catalog-evaluator-v1',
    description: 'Sampled discoverability checks.',
    unit: 'catalog checks',
    checks: [
      {
        id: 'one',
        label: 'Observed product',
        result: 'pass',
        evidenceIds: [scan.draft.evidence[0].id],
      },
      {
        id: 'two',
        label: 'Missing coverage',
        result: 'unknown',
        evidenceIds: [scan.draft.evidence[0].id],
      },
    ],
  };
  const post = (owner: string, data: unknown) =>
    handleGateway(
      new Request(`http://gateway.test/api/gateway/${path.join('/')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      path,
      async () => owner,
      service,
    );
  expect((await post('merchant-b', report)).status).toBe(404);
  expect(
    (
      await post('merchant-a', {
        ...report,
        checks: [{ ...report.checks[0], evidenceIds: ['00000000-0000-4000-8000-000000000099'] }],
      })
    ).status,
  ).toBe(422);
  expect((await post('merchant-a', { ...report, score: 100 })).status).toBe(400);
  expect(
    (await post('merchant-a', { ...report, checks: [report.checks[0], report.checks[0]] })).status,
  ).toBe(400);
  expect((await post('merchant-a', report)).status).toBe(200);
  const stored = await new FileStore(directory).get('scan', 'merchant-a', scan.id);
  expect(stored.categoryReports?.[0].producer).toBe('catalog-evaluator-v1');
  const response = await handleGateway(
    new Request(`http://gateway.test/api/gateway/dashboard?scanId=${scan.id}`),
    ['dashboard'],
    async () => 'merchant-a',
    service,
  );
  const data = (await response.json()).data.readiness;
  expect(data.categories[0]).toMatchObject({
    score: 100,
    passed: 1,
    unknown: 1,
    total: 2,
    source: 'catalog-evaluator-v1',
  });
  expect(data.categories.find((c: { id: string }) => c.id === 'checkout').score).toBeNull();
  expect(data.fixture).toBe(true);
});
