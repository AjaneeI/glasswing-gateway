import { test, expect } from '@playwright/test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { StorefrontBrowser } from '../../lib/gateway/browser';
import { environments } from '../../lib/gateway/config';
import configs from '../../config/gateway-demo-environments.json';

// Explicit opt-in: these checks make real read-only requests to external demos.
test.skip(process.env.GATEWAY_LIVE_STOREFRONTS !== '1', 'External storefront checks are opt-in.');
for (const [index, config] of configs.entries()) {
  test(`${config.id}: sample, inspect product, search`, async ({}, testInfo) => {
    test.setTimeout(120_000);
    process.env.GATEWAY_TEST_ENVIRONMENTS = JSON.stringify(configs);
    const local = join(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
    if (existsSync(local)) process.env.GATEWAY_CHROMIUM_PATH = local;
    const browser = await StorefrontBrowser.open(
      environments()[index],
      AbortSignal.timeout(110_000),
    );
    const observations = [];
    try {
      let page = await browser.observe(new URL(config.entryPath || '/', config.origin).href);
      observations.push(page);
      expect(page.text.length).toBeGreaterThan(100);
      if (!page.links.some((link) => /\/products\/[^/?]+/.test(link.url))) {
        const catalog = page.links.find(
          (link) => new URL(link.url).pathname.endsWith('/products') && !new URL(link.url).search,
        );
        expect(
          catalog,
          'An empty pagination page must expose a route back to the catalog',
        ).toBeTruthy();
        page = await browser.observe(catalog!.url);
        observations.push(page);
      }
      const product = page.links.find((link) => /\/products\/[^/?]+/.test(link.url));
      expect(product, 'A discoverable product link is required').toBeTruthy();
      let detail = await browser.observe(product!.url, 'product');
      observations.push(detail);
      if (detail.products.length > 1) {
        const variant = detail.links.find((link) => new URL(link.url).searchParams.has('variant'));
        expect(variant, 'Multiple variants must expose an inspectable variant URL').toBeTruthy();
        detail = await browser.observe(variant!.url, 'product');
        observations.push(detail);
      }
      expect(detail.products).toHaveLength(1);
      expect(detail.products[0].price).not.toBeNull();
      const search = await browser.execute({
        type: 'search',
        query: detail.products[0].name.split(' ')[0],
        url: null,
        disposition: null,
        productObservationId: null,
        reason: 'Verify storefront search.',
      });
      observations.push(search!);
      expect(search!.links.some((link) => /\/products\/[^/?]+/.test(link.url))).toBeTruthy();
    } finally {
      await writeFile(
        testInfo.outputPath('observations.json'),
        JSON.stringify(observations, null, 2),
      );
      await testInfo.attach('live-observations', {
        body: JSON.stringify(observations, null, 2),
        contentType: 'application/json',
      });
      await browser.close();
    }
  });
}
