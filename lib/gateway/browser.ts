import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { GatewayError } from './errors';
import type { TestEnvironment } from './config';
import type { Action, Observation, Scenario } from './schemas';
import { paymentFieldPattern, testIdentity } from './test-identity';

/**
 * Ordered [pattern, value] pairs handed into the page context so checkout
 * fields can be matched by name/id/autocomplete. Payment fields are absent by
 * construction — there is no value here that could fill one.
 */
function checkoutFieldMap(): [string, string][] {
  return [
    ['first[_-]?name|given[_-]?name', testIdentity.firstName],
    ['last[_-]?name|family[_-]?name|surname', testIdentity.lastName],
    ['e[-_]?mail', testIdentity.email],
    ['phone|tel|mobile', testIdentity.phone],
    ['address.?2|apartment|apt|suite', testIdentity.address2],
    ['address|street|line1', testIdentity.address1],
    ['city|town|locality', testIdentity.city],
    ['province|state|region', testIdentity.provinceCode],
    ['zip|postal|postcode', testIdentity.zip],
    ['country', testIdentity.countryCode],
  ];
}

// Never reachable, on any environment, however it is configured. These are
// the paths where a mistake is not recoverable: someone else's account, the
// admin surface, an existing order, or a payment page.
const alwaysForbiddenPath =
  /(?:^|\/)(?:account|login|logout|admin|orders?|payments?|subscribe|purchase|buy|complete|finalize|process)(?:[/.]|$)/i;
// Blocked by default, reachable only on an environment that has explicitly
// opted into checkout testing and listed the path in checkout.pathPrefixes.
const mutationPath = /(?:^|\/)(?:checkout|cart|purchase|buy)(?:\/|$)/i;

/** True when this path is inside the environment's opted-in checkout surface. */
export function isCheckoutPath(path: string, env: TestEnvironment) {
  if (!env.checkout?.enabled) return false;
  return env.checkout.pathPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/$/, '')}/`),
  );
}
export function allowedUrl(raw: string, env: TestEnvironment): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GatewayError(
      'ACTION_BLOCKED',
      'The action requires an absolute storefront URL.',
      422,
    );
  }
  let path: string;
  try {
    path = decodeURIComponent(decodeURIComponent(url.pathname));
  } catch {
    throw new GatewayError('ACTION_BLOCKED', 'Invalid URL encoding.', 422);
  }
  if (
    url.origin !== env.origin ||
    url.username ||
    url.password ||
    !['https:', 'http:'].includes(url.protocol) ||
    path.includes('\\') ||
    path.split('/').includes('..') ||
    alwaysForbiddenPath.test(path) ||
    (mutationPath.test(path) && !isCheckoutPath(path, env)) ||
    !(
      env.allowedPathPrefixes.some((prefix) =>
        prefix === '/'
          ? path === '/'
          : path === prefix || path.startsWith(`${prefix.replace(/\/$/, '')}/`),
      ) || isCheckoutPath(path, env)
    )
  ) {
    throw new GatewayError(
      'ACTION_BLOCKED',
      'This URL is outside the configured read-only storefront boundary.',
      422,
    );
  }
  // Discard attribution before any request; pagination/asset parameters require
  // explicit server configuration. Unknown query keys still fail closed.
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_(source|medium|campaign|term|content)$/i.test(key)) url.searchParams.delete(key);
  }
  // Checkout query keys require the same explicit policy as every other page.
  if (
    [...url.searchParams.keys()].some(
      (key) =>
        !(key === env.searchQueryParam && url.pathname === env.searchPath) &&
        !env.readOnlyQueryRules?.some(
          (rule) =>
            (path === rule.pathPrefix ||
              path.startsWith(`${rule.pathPrefix.replace(/\/$/, '')}/`)) &&
            rule.names.includes(key),
        ),
    )
  )
    throw new GatewayError(
      'ACTION_BLOCKED',
      'Only configured read-only storefront query parameters are permitted.',
      422,
    );
  url.hash = '';
  return url.href;
}
export function safeAddress(address: string, allowLoopback: boolean) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast' || (allowLoopback && parsed.range() === 'loopback');
  } catch {
    return false;
  }
}
export async function pinnedHost(env: TestEnvironment) {
  const hostname = new URL(env.origin).hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((item) => !safeAddress(item.address, env.allowLoopback)))
    throw new GatewayError(
      'UNSAFE_DESTINATION',
      'The configured storefront resolves to a prohibited network address.',
      422,
    );
  return addresses[0].address;
}

// Playwright routing only intercepts the first URL in a server redirect chain.
// Forward requests ourselves to the validated IP; never send a redirect to Chromium.
// TLS still verifies the original hostname. No proxy or secondary DNS lookup is used.
export async function readResource(
  raw: string,
  address: string,
  headers: Record<string, string>,
  method: string,
  signal: AbortSignal,
  body?: Buffer | null,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const url = new URL(raw);
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        servername: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: { ...headers, host: url.host, 'accept-encoding': 'identity' },
        signal,
        agent: false,
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
          response.destroy();
          reject(
            new GatewayError(
              'REDIRECT_BLOCKED',
              'HTTP redirects are blocked. Configure the canonical storefront URL.',
              422,
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 4_000_000) {
            response.destroy(
              new GatewayError('RESOURCE_TOO_LARGE', 'Storefront resource exceeds 4 MB.', 422),
            );
          } else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          const forwarded: Record<string, string> = {};
          for (const [name, value] of Object.entries(response.headers)) {
            if (
              value !== undefined &&
              !['connection', 'transfer-encoding', 'content-length'].includes(name)
            )
              forwarded[name] = Array.isArray(value) ? value.join('\n') : value;
          }
          resolve({
            status: response.statusCode || 502,
            headers: forwarded,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.setTimeout(15_000, () => request.destroy(new Error('Storefront request timed out.')));
    request.on('error', reject);
    if (body?.length) request.write(body);
    request.end();
  });
}
export function validateAction(
  action: Action,
  scenario: Scenario,
  env: TestEnvironment,
  observations: Observation[],
) {
  if (!scenario.permittedActions.includes(action.type))
    throw new GatewayError(
      'ACTION_BLOCKED',
      'Action is not permitted by the reviewed scenario.',
      422,
    );
  if (action.type === 'stop') {
    if (
      !action.disposition ||
      action.url !== null ||
      action.query !== null ||
      (action.disposition === 'recommend' &&
        !observations.some(
          (obs) =>
            obs.id === action.productObservationId &&
            obs.kind === 'product' &&
            obs.products.length === 1,
        ))
    )
      throw new GatewayError(
        'ACTION_BLOCKED',
        'A recommendation must reference an inspected page with exactly one observed product.',
        422,
      );
    return;
  }
  if (action.disposition !== null || action.productObservationId !== null)
    throw new GatewayError('ACTION_BLOCKED', 'Non-stop actions cannot declare an outcome.', 422);
  if (action.type === 'search') {
    if (!action.query?.trim() || action.url !== null)
      throw new GatewayError(
        'ACTION_BLOCKED',
        'Search requires a query and no arbitrary URL.',
        422,
      );
    return;
  }
  if (
    action.type === 'view_cart' ||
    action.type === 'begin_checkout' ||
    action.type === 'fill_checkout' ||
    action.type === 'add_to_cart'
  ) {
    if (!env.checkout?.enabled)
      throw new GatewayError(
        'ACTION_BLOCKED',
        'Checkout testing is not enabled for this environment.',
        422,
      );
    if (action.query !== null)
      throw new GatewayError('ACTION_BLOCKED', 'Checkout actions take no search query.', 422);
    // add_to_cart may name the product page it should act on; the rest operate
    // on the cart and checkout surface and take no URL.
    if (action.type === 'add_to_cart') {
      const target = action.url ? allowedUrl(action.url, env) : observations.at(-1)?.url;
      if (
        !target ||
        !observations.some(
          (obs) => obs.url === target && obs.kind === 'product' && obs.products.length === 1,
        )
      )
        throw new GatewayError(
          'ACTION_BLOCKED',
          'Adding to cart requires a previously inspected single-product page.',
          422,
        );
    } else if (action.url !== null)
      throw new GatewayError('ACTION_BLOCKED', 'This checkout action takes no URL.', 422);
    return;
  }
  if (!action.url || action.query !== null)
    throw new GatewayError('ACTION_BLOCKED', 'Navigation requires a URL and no search query.', 422);
  const target = allowedUrl(action.url, env);
  const discovered = observations.some(
    (obs) => obs.url === target || obs.links.some((link) => link.url === target),
  );
  if (!discovered)
    throw new GatewayError(
      'ACTION_BLOCKED',
      'The shopper may navigate only to URLs discovered in observations.',
      422,
    );
}
export interface ShopperBrowser {
  screenshot?(): Promise<Buffer>;
  observe(url: string, kind?: 'page' | 'product'): Promise<Observation>;
  execute(action: Action): Promise<Observation | null>;
  close(): Promise<void>;
}
export type BrowserFactory = (env: TestEnvironment, signal: AbortSignal) => Promise<ShopperBrowser>;
type CartGrant = { url: string; body: string; consumed: boolean };
export class StorefrontBrowser implements ShopperBrowser {
  private inspected = new Set<string>();
  private constructor(
    private browser: Browser,
    private context: BrowserContext,
    private page: Page,
    private env: TestEnvironment,
    private cleanup: () => void,
    private failures: Map<string, GatewayError>,
    private mutation: { grant: CartGrant | null },
  ) {}
  static async open(env: TestEnvironment, signal: AbortSignal): Promise<StorefrontBrowser> {
    signal.throwIfAborted();
    const address = await pinnedHost(env);
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.GATEWAY_CHROMIUM_PATH
        ? { executablePath: process.env.GATEWAY_CHROMIUM_PATH }
        : {}),
      args: [
        '--host-resolver-rules=MAP * ~NOTFOUND',
        '--no-proxy-server',
        '--disable-quic',
        '--disable-background-networking',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    const abort = () => {
      void browser.close().catch(() => {});
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      const context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: 'block',
        viewport: { width: 1280, height: 900 },
      });
      context.setDefaultTimeout(10_000);
      context.setDefaultNavigationTimeout(20_000);
      const failures = new Map<string, GatewayError>();
      const mutation: { grant: CartGrant | null } = { grant: null };
      await context.route('**/*', async (route) => {
        const request = route.request();
        try {
          const resourceUrl = allowedUrl(request.url(), env);
          // Cart mutation endpoints must never be reached through navigation,
          // images, or other GET/HEAD requests, even in checkout-enabled mode.
          if (
            ['GET', 'HEAD'].includes(request.method()) &&
            /\/cart\/(?:add|change|update|clear)(?:[/.]|$)/i.test(
              decodeURIComponent(decodeURIComponent(new URL(resourceUrl).pathname)),
            )
          )
            throw new Error('Cart mutations require an action-bound POST.');
          if (!['GET', 'HEAD'].includes(request.method())) {
            const grant = mutation.grant;
            if (
              !grant ||
              grant.consumed ||
              request.method() !== 'POST' ||
              request.url() !== grant.url ||
              request.postData() !== grant.body ||
              request.headers()['content-type']?.split(';')[0] !==
                'application/x-www-form-urlencoded'
            )
              throw new Error();
            grant.consumed = true;
          }
          await route.fulfill(
            await readResource(
              resourceUrl,
              address,
              await request.allHeaders(),
              request.method(),
              signal,
              request.postDataBuffer(),
            ),
          );
        } catch (error) {
          if (request.isNavigationRequest() && error instanceof GatewayError)
            failures.set(request.url(), error);
          await route.abort('blockedbyclient').catch(() => {});
        }
      });
      await context.routeWebSocket('**/*', (socket) => socket.close());
      const page = await context.newPage();
      context.on('page', (popup) => {
        if (popup !== page) void popup.close().catch(() => {});
      });
      page.on('dialog', (dialog) => void dialog.dismiss().catch(() => {}));
      return new StorefrontBrowser(
        browser,
        context,
        page,
        env,
        () => signal.removeEventListener('abort', abort),
        failures,
        mutation,
      );
    } catch (error) {
      signal.removeEventListener('abort', abort);
      await browser.close();
      throw error;
    }
  }
  async observe(raw: string, kind: 'page' | 'product' = 'page'): Promise<Observation> {
    const url = allowedUrl(raw, this.env);
    this.failures.delete(url);
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {
      throw (
        this.failures.get(url) ||
        new GatewayError(
          'STOREFRONT_UNAVAILABLE',
          'Storefront navigation failed or timed out.',
          502,
          true,
        )
      );
    });
    if (!response || !response.ok())
      throw new GatewayError(
        'STOREFRONT_ERROR',
        `Storefront returned ${response?.status() || 'no response'}.`,
        502,
        true,
      );
    allowedUrl(this.page.url(), this.env);
    return this.snapshot(kind);
  }
  /**
   * Scrapes whatever the page currently shows, without navigating. Checkout
   * actions need this: re-navigating after filling a form would discard the
   * values that were just entered.
   */
  async snapshot(kind: 'page' | 'product' = 'page'): Promise<Observation> {
    await this.page.locator('body').waitFor();
    // Streamed storefronts can hydrate their catalog after DOMContentLoaded.
    // Bound both loading and DOM settling; background analytics must not hang a session.
    await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let quiet: ReturnType<typeof setTimeout>;
          const finish = () => {
            clearTimeout(quiet);
            clearTimeout(deadline);
            observer.disconnect();
            resolve();
          };
          const observer = new MutationObserver(() => {
            clearTimeout(quiet);
            quiet = setTimeout(finish, 500);
          });
          const deadline = setTimeout(finish, 3000);
          observer.observe(document.body, { subtree: true, childList: true, characterData: true });
          quiet = setTimeout(finish, 500);
        }),
    );
    // Capture rendered text and literal JSON-LD. Never accept model-invented prices as evidence.
    const snapshot = await this.page.evaluate(() => {
      const text = document.body.innerText.slice(0, 12000);
      const seenLinks = new Set<string>();
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .slice(0, 1000)
        .filter((link) => {
          if (seenLinks.has(link.href)) return false;
          seenLinks.add(link.href);
          return true;
        })
        .slice(0, 100)
        .map((link) => ({
          url: link.href,
          text: (link.innerText || link.getAttribute('aria-label') || '').slice(0, 160),
        }));
      const products: { name: string; price: number | null; currency: string | null }[] = [];
      function visit(value: unknown, depth = 0) {
        if (depth > 10 || !value || typeof value !== 'object' || products.length >= 20) return;
        if (Array.isArray(value)) {
          value.slice(0, 100).forEach((entry) => visit(entry, depth + 1));
          return;
        }
        const node = value as Record<string, unknown>;
        if (
          node['@type'] === 'Product' ||
          (Array.isArray(node['@type']) && node['@type'].includes('Product'))
        ) {
          const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          const offer =
            offers && typeof offers === 'object' ? (offers as Record<string, unknown>) : {};
          // ProductGroup variants carry literal offer URLs. Make them discoverable
          // so the shopper can inspect one variant without guessing its identifier.
          let offerUrl: URL | undefined;
          try {
            if (typeof offer.url === 'string') {
              offerUrl = new URL(offer.url, location.href);
              links.push({ url: offerUrl.href, text: String(node.name || '').slice(0, 160) });
            }
          } catch {}
          const selectedVariant = new URL(location.href).searchParams.get('variant');
          if (
            selectedVariant &&
            (!offerUrl ||
              offerUrl.origin !== location.origin ||
              offerUrl.pathname !== location.pathname ||
              offerUrl.searchParams.get('variant') !== selectedVariant)
          )
            return;
          let price =
            (typeof offer.price === 'string' && offer.price.trim() !== '') ||
            typeof offer.price === 'number'
              ? Number(offer.price)
              : NaN;
          // An aggregate range is not an exact purchasable price. Accept it only
          // when both literal bounds agree (Saleor's single-price products).
          if (offer['@type'] === 'AggregateOffer' && !Number.isFinite(price)) {
            const low =
              typeof offer.lowPrice === 'number' ||
              (typeof offer.lowPrice === 'string' && offer.lowPrice.trim())
                ? Number(offer.lowPrice)
                : NaN;
            const high =
              typeof offer.highPrice === 'number' ||
              (typeof offer.highPrice === 'string' && offer.highPrice.trim())
                ? Number(offer.highPrice)
                : NaN;
            if (Number.isFinite(low) && low === high) price = low;
          }
          products.push({
            name: String(node.name || '').slice(0, 300),
            price: Number.isFinite(price) && price >= 0 ? price : null,
            currency:
              typeof offer.priceCurrency === 'string' ? offer.priceCurrency.slice(0, 10) : null,
          });
        }
        Object.values(node)
          .slice(0, 100)
          .forEach((entry) => visit(entry, depth + 1));
      }
      for (const script of Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      ).slice(0, 20)) {
        try {
          if ((script.textContent?.length || 0) < 100000)
            visit(JSON.parse(script.textContent || ''));
        } catch {}
      }
      return { title: document.title.slice(0, 300), text, links, products };
    });
    if (kind === 'product' && snapshot.products.length === 1) this.inspected.add(this.page.url());
    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      url: this.page.url(),
      ...snapshot,
      links: snapshot.links.flatMap((link) => {
        try {
          return [{ ...link, url: allowedUrl(link.url, this.env) }];
        } catch {
          return [];
        }
      }),
      kind,
    };
  }
  private requireCheckoutEnabled() {
    if (!this.env.checkout?.enabled)
      throw new GatewayError(
        'ACTION_BLOCKED',
        'Checkout testing is not enabled for this environment.',
        422,
      );
  }
  async execute(action: Action) {
    if (action.type === 'stop') return null;
    if (action.type === 'search') {
      const url = new URL(this.env.searchPath, this.env.origin);
      url.searchParams.set(this.env.searchQueryParam, action.query!);
      return this.observe(url.href);
    }
    if (action.type === 'add_to_cart') {
      this.requireCheckoutEnabled();
      const target = action.url ? allowedUrl(action.url, this.env) : this.page.url();
      if (!this.inspected.has(target))
        throw new GatewayError(
          'ACTION_BLOCKED',
          'Inspect this product before adding it to the cart.',
          422,
        );
      if (target !== this.page.url()) await this.observe(target, 'product');
      const path = this.env.checkout?.cartAddPath;
      if (!path)
        throw new GatewayError(
          'ACTION_BLOCKED',
          'A server-configured cart-add adapter is required.',
          422,
        );
      const url = allowedUrl(new URL(path, this.env.origin).href, this.env);
      const variant = await this.page.locator('form').evaluateAll((forms, targetUrl) => {
        const form = forms.find((node) => (node as HTMLFormElement).action === targetUrl);
        return (
          form?.querySelector<HTMLInputElement | HTMLSelectElement>('[name="id"]')?.value || ''
        );
      }, url);
      if (!/^\d{1,30}$/.test(variant))
        throw new GatewayError('ACTION_BLOCKED', 'No supported product variant was observed.', 422);
      const body = new URLSearchParams({ id: variant, quantity: '1' }).toString();
      this.mutation.grant = { url, body, consumed: false };
      try {
        const ok = await this.page.evaluate(
          async ({ url, body }) => {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
              redirect: 'error',
            });
            return response.ok;
          },
          { url, body },
        );
        if (!ok || !this.mutation.grant.consumed) throw new Error('Cart request failed');
      } finally {
        this.mutation.grant = null;
      }
      return this.observe(new URL('/cart', this.env.origin).href);
    }
    if (action.type === 'view_cart') {
      this.requireCheckoutEnabled();
      return this.observe(new URL('/cart', this.env.origin).href);
    }
    if (action.type === 'begin_checkout') {
      this.requireCheckoutEnabled();
      const cart = await this.observe(new URL('/cart', this.env.origin).href);
      const link = cart.links.find((item) =>
        /^\/checkout(?:\/|$)/.test(new URL(item.url).pathname),
      );
      if (!link)
        throw new GatewayError(
          'ACTION_BLOCKED',
          'No permitted checkout navigation link was observed.',
          422,
        );
      return this.observe(link.url);
    }
    if (action.type === 'fill_checkout') {
      this.requireCheckoutEnabled();
      // Shopify's one-page checkout puts contact, delivery and payment on a
      // single page, so refusing the whole page when a card field exists would
      // make checkout untestable. The guard is therefore per field, not per
      // page: fill contact and delivery, skip anything payment or billing, and
      // click nothing. Network mutations from input/change handlers are blocked.
      const filled = await this.page
        .locator('input:visible, select:visible')
        .evaluateAll(
          (nodes, { identity, skip }) => {
            const blocked = new RegExp(skip, 'i');
            const entered: string[] = [];
            for (const node of nodes) {
              const element = node as HTMLInputElement | HTMLSelectElement;
              const descriptor = [
                element.getAttribute('name'),
                element.getAttribute('id'),
                element.getAttribute('autocomplete'),
                element.getAttribute('placeholder'),
                element.getAttribute('aria-label'),
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              // Never a card field, and never a billing field either: the
              // shopper stops at billing by design.
              if (blocked.test(descriptor)) continue;
              const match = identity.find(([pattern]) => new RegExp(pattern, 'i').test(descriptor));
              if (!match || !match[1]) continue;
              element.value = match[1];
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              entered.push(descriptor.slice(0, 40));
            }
            return entered;
          },
          { identity: checkoutFieldMap(), skip: `${paymentFieldPattern.source}|billing` },
        )
        .catch(() => [] as string[]);
      if (!filled.length)
        throw new GatewayError(
          'ACTION_BLOCKED',
          'No contact or delivery fields could be filled on this page.',
          422,
        );
      return this.snapshot('page');
    }
    return this.observe(action.url!, action.type === 'inspect_product' ? 'product' : 'page');
  }
  async close() {
    this.cleanup();
    await this.context.close().catch(() => {});
    await this.browser.close();
  }
  async screenshot() {
    return this.page.screenshot({
      type: 'jpeg',
      quality: 65,
      fullPage: false,
      timeout: 2500,
      animations: 'disabled',
    });
  }
}
export const browserFactory: BrowserFactory = (env, signal) => StorefrontBrowser.open(env, signal);
