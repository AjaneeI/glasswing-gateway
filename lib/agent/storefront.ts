import type { Severity } from '@/lib/types';

export const STOREFRONT_HOST = 'evertrailoutdoors.com';
export const STOREFRONT_ORIGIN = `https://${STOREFRONT_HOST}`;

export interface StorefrontVariant {
  color?: string;
  capacity?: string;
}

export interface StorefrontProduct {
  slug: string;
  sku: string;
  name: string;
  price: number;
  rating: number;
  category: string;
  description: string;
  variants: StorefrontVariant[];
}

export const catalog: StorefrontProduct[] = [
  {
    slug: 'trailhead-28',
    sku: 'TH28',
    name: 'Trailhead 28 Daypack',
    price: 129,
    rating: 4.6,
    category: 'Backpacks',
    description: 'Lightweight 28L daypack with a hydration sleeve.',
    variants: [],
  },
  {
    slug: 'summit-trail-45l',
    sku: 'ST45',
    name: 'Summit Trail 45L',
    price: 199,
    rating: 4.9,
    category: 'Backpacks',
    description: 'Multi-day hiking pack with adjustable suspension.',
    variants: [
      { color: 'Forest', capacity: '45L' },
      { color: 'Forest', capacity: '55L' },
      { color: 'Charcoal', capacity: '45L' },
      { color: 'Charcoal', capacity: '55L' },
    ],
  },
  {
    slug: 'alpine-pro-55',
    sku: 'AP55',
    name: 'Alpine Pro 55',
    price: 259,
    rating: 4.8,
    category: 'Backpacks',
    description: 'Expedition pack with reinforced load transfer.',
    variants: [],
  },
  {
    slug: 'insulated-jacket',
    sku: 'IJ100',
    name: 'Ridgeline Insulated Jacket',
    price: 175,
    rating: 4.5,
    category: 'Apparel',
    description: 'Synthetic insulated jacket rated to -10C.',
    variants: [],
  },
];

export interface PolicyResult {
  name: string;
  machineReadable: boolean;
  body: string;
}

const shippingPolicy: PolicyResult = {
  name: 'Shipping',
  machineReadable: false,
  body: 'Orders ship in 3-5 business days. Delivery estimates may vary by destination. Contact support for international shipping.',
};

const returnsPolicy: PolicyResult = {
  name: 'Returns',
  machineReadable: false,
  body: 'We want you to love your gear. Returns are accepted within 30 days for unused items. Some exclusions apply. See store for details or contact support.',
};

export function getPolicy(type: string): PolicyResult | null {
  const normalized = type.toLowerCase();
  if (normalized.startsWith('ship')) return shippingPolicy;
  if (normalized.startsWith('return')) return returnsPolicy;
  return null;
}

export interface StructuredData {
  type: string;
  data: Record<string, unknown>;
}

function productStructuredData(product: StorefrontProduct): StructuredData {
  return {
    type: 'Product',
    data: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      sku: product.sku,
      description: product.description,
      aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating },
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  };
}

export function extractStructuredData(path: string): StructuredData[] {
  const product = catalog.find((item) => path.includes(item.slug));
  if (product) return [productStructuredData(product)];
  return [];
}

function htmlShell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><header>Evertrail Outdoors</header><main>${body}</main><footer>Made for the way out.</footer></body></html>`;
}

function renderProductPage(product: StorefrontProduct): string {
  const structured = JSON.stringify(productStructuredData(product).data);
  const variantMarkup = product.variants.length
    ? `<form><label>Color <select name="color">${product.variants
        .map((v) => v.color)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((c) => `<option>${c}</option>`)
        .join('')}</select></label><label>Capacity <select name="capacity">${product.variants
        .map((v) => v.capacity)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((c) => `<option>${c}</option>`)
        .join('')}</select></label><button type="submit">Add to cart</button></form>`
    : '<button>Add to cart</button>';
  return htmlShell(
    product.name,
    `<h1>${product.name}</h1><p class="price">$${product.price.toFixed(2)}</p><p class="rating">${product.rating} / 5</p><p class="sku" data-sku="${product.sku}">SKU: ${product.sku}</p><p>${product.description}</p>${variantMarkup}<script type="application/ld+json">${structured}</script>`,
  );
}

export function resolvePage(url: string): { status: number; body: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== STOREFRONT_HOST) return null;
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') {
    return {
      status: 200,
      body: htmlShell(
        'Evertrail Outdoors',
        `<h1>Gear for the way out</h1><p>${catalog.length} products across ${new Set(catalog.map((p) => p.category)).size} categories.</p><ul>${catalog.map((p) => `<li><a href="/products/${p.slug}">${p.name}</a> — $${p.price}</li>`).join('')}</ul>`,
      ),
    };
  }
  const product = catalog.find((item) => path === `/products/${item.slug}`);
  if (product) return { status: 200, body: renderProductPage(product) };
  if (path.startsWith('/products')) {
    return {
      status: 200,
      body: htmlShell(
        'Shop',
        `<h1>Shop</h1><ul>${catalog.map((p) => `<li><a href="/products/${p.slug}">${p.name}</a> — $${p.price}</li>`).join('')}</ul>`,
      ),
    };
  }
  const policy = path.startsWith('/policies/shipping')
    ? shippingPolicy
    : path.startsWith('/policies/returns')
      ? returnsPolicy
      : null;
  if (policy) return { status: 200, body: htmlShell(policy.name, `<h1>${policy.name} policy</h1><p>${policy.body}</p>`) };
  return { status: 404, body: htmlShell('Not found', '<h1>404</h1>') };
}

export interface CheckoutResult {
  ok: boolean;
  reason: string;
  total: number | null;
  confirmationRequired: boolean;
}

export function attemptCheckout(sku: string, quantity: number, maxSpend: number): CheckoutResult {
  const product = catalog.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
  if (!product) {
    return {
      ok: false,
      reason: `No purchasable SKU "${sku}". The variant selector exposes colors and capacities but structured data and checkout only recognize the base SKU.`,
      total: null,
      confirmationRequired: false,
    };
  }
  const total = Number((product.price * quantity).toFixed(2));
  if (total > maxSpend) {
    return {
      ok: false,
      reason: `Total $${total.toFixed(2)} exceeds the authorized spend of $${maxSpend.toFixed(2)}.`,
      total,
      confirmationRequired: false,
    };
  }
  return { ok: true, reason: 'Order simulation accepted.', total, confirmationRequired: false };
}

export interface StorefrontFindingTemplate {
  match: (context: { goal: string }) => boolean;
  finding: {
    title: string;
    severity: Severity;
    category: string;
    evidence: string;
    whyAgentsFail: string;
    suggestedFix: string;
  };
}

export const knownFailureTemplates: StorefrontFindingTemplate[] = [
  {
    match: () => true,
    finding: {
      title: 'Variant selections do not map to purchasable SKUs',
      severity: 'Critical',
      category: 'Product semantics',
      evidence: 'The Summit Trail 45L exposes color and capacity selectors, but its JSON-LD stays on the base SKU "ST45" and checkout rejects derived variant SKUs.',
      whyAgentsFail: 'An agent that reasons about a chosen color/capacity cannot address the exact configuration it wants to buy, so the goal fails at checkout.',
      suggestedFix: 'Emit schema.org ProductGroup with hasVariant entries (e.g. ST45-FOR) and accept every variant SKU at checkout.',
    },
  },
  {
    match: () => true,
    finding: {
      title: 'Shipping policy is not destination-aware',
      severity: 'High',
      category: 'Policies',
      evidence: 'The shipping policy returns "3-5 business days" without a country or postal code input.',
      whyAgentsFail: 'Agents cannot verify delivery eligibility or timing before committing the customer to a purchase promise.',
      suggestedFix: 'Expose a destination-aware shipping endpoint returning constraints per country and postal code.',
    },
  },
  {
    match: () => true,
    finding: {
      title: 'Returns policy is human-readable only',
      severity: 'Medium',
      category: 'Policies',
      evidence: 'Return eligibility exists as prose ("30 days, some exclusions apply") with no machine-readable schema.',
      whyAgentsFail: 'Agents cannot confirm return terms, so they either refuse to buy or misstate policy to the customer.',
      suggestedFix: 'Publish returns terms as structured data (MerchantReturnPolicy) alongside the page copy.',
    },
  },
  {
    match: () => true,
    finding: {
      title: 'High-value checkout has no confirmation requirement',
      severity: 'High',
      category: 'Security',
      evidence: 'Checkout simulations complete without any explicit confirmation step regardless of order amount.',
      whyAgentsFail: 'An agent acting past its authorized spend can place an order with no confirmation gate, creating financial and trust risk.',
      suggestedFix: 'Require a signed confirmation token bound to the final order amount above a configurable threshold.',
    },
  },
];