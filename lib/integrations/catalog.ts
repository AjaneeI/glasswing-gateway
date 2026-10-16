export const categories = [
  'All integrations',
  'Commerce',
  'Payments',
  'Infrastructure',
  'Development',
  'Observability',
] as const;
export type Category = (typeof categories)[number];
export type Integration = {
  id: string;
  name: string;
  color: string;
  category: Exclude<Category, 'All integrations'>;
  description: string;
  capability: string;
  docsUrl: string;
  website: string;
  urlLabel: string;
  placeholder: string;
};
export const integrations: Integration[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    color: '#64952f',
    category: 'Commerce',
    description: 'Keep your storefront, product catalog, and checkout within reach.',
    capability: 'Storefront & catalog',
    website: 'https://admin.shopify.com',
    docsUrl: 'https://help.shopify.com',
    urlLabel: 'Store or admin URL',
    placeholder: 'https://admin.shopify.com/store/your-store',
  },
  {
    id: 'commercetools',
    name: 'commercetools',
    color: '#6350d5',
    category: 'Commerce',
    description: 'Bring your headless commerce projects into your daily workflow.',
    capability: 'Composable commerce',
    website: 'https://commercetools.com',
    docsUrl: 'https://docs.commercetools.com/merchant-center',
    urlLabel: 'Merchant Center project URL',
    placeholder: 'https://mc.europe-west1.gcp.commercetools.com/your-project',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    color: '#635bff',
    category: 'Payments',
    description: 'Jump into your payment dashboard to investigate checkout issues.',
    capability: 'Payments & checkout',
    website: 'https://dashboard.stripe.com',
    docsUrl: 'https://docs.stripe.com',
    urlLabel: 'Stripe dashboard URL',
    placeholder: 'https://dashboard.stripe.com/test/dashboard',
  },
  {
    id: 'adyen',
    name: 'Adyen',
    color: '#0a9c56',
    category: 'Payments',
    description: 'Get to payment activity and authorization details in your Customer Area.',
    capability: 'Payment operations',
    website: 'https://ca-live.adyen.com',
    docsUrl: 'https://docs.adyen.com/account',
    urlLabel: 'Customer Area URL',
    placeholder: 'https://ca-test.adyen.com',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    color: '#ef8425',
    category: 'Infrastructure',
    description: 'Review the edge security and bot policies protecting your storefront.',
    capability: 'Edge & bot protection',
    website: 'https://dash.cloudflare.com',
    docsUrl: 'https://developers.cloudflare.com',
    urlLabel: 'Cloudflare dashboard URL',
    placeholder: 'https://dash.cloudflare.com/your-account',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    color: '#171717',
    category: 'Infrastructure',
    description: 'Move from a shopping-session finding to the deployment behind it.',
    capability: 'Preview & production',
    website: 'https://vercel.com/dashboard',
    docsUrl: 'https://vercel.com/docs',
    urlLabel: 'Team or project URL',
    placeholder: 'https://vercel.com/your-team/your-project',
  },
  {
    id: 'github',
    name: 'GitHub',
    color: '#24292f',
    category: 'Development',
    description: 'Keep the repository where you investigate issues and ship fixes close by.',
    capability: 'Repositories & issues',
    website: 'https://github.com',
    docsUrl: 'https://docs.github.com',
    urlLabel: 'Repository URL',
    placeholder: 'https://github.com/organization/repository',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    color: '#774aa4',
    category: 'Observability',
    description: 'Open the dashboards and traces that explain your shopping experience.',
    capability: 'Monitoring & traces',
    website: 'https://www.datadoghq.com',
    docsUrl: 'https://docs.datadoghq.com',
    urlLabel: 'Dashboard URL',
    placeholder: 'https://app.datadoghq.com/dashboard/your-dashboard',
  },
  {
    id: 'webhook',
    name: 'CI/CD Webhook',
    color: '#48739e',
    category: 'Development',
    description: 'Keep a shortcut to the pipeline that runs your deployment checks.',
    capability: 'Pipelines & automation',
    website: 'https://docs.github.com/en/actions',
    docsUrl: 'https://docs.github.com/en/webhooks',
    urlLabel: 'Pipeline dashboard URL',
    placeholder: 'https://github.com/organization/repository/actions',
  },
];
export type Connection = { name: string; url: string };
export type Connections = Record<string, Connection>;
export function normalizeDestination(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.'))
    throw new Error('Enter a full HTTPS URL without embedded credentials.');
  return url.href;
}
export function readConnections(raw: string | null): Connections {
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid saved links.');
  const result: Connections = {};
  for (const { id } of integrations) {
    const item = (value as Record<string, unknown>)[id];
    if (!item || typeof item !== 'object') continue;
    const { name, url } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim() || typeof url !== 'string') continue;
    try {
      result[id] = { name: name.slice(0, 100), url: normalizeDestination(url) };
    } catch {
      /* Ignore invalid stored destinations. */
    }
  }
  return result;
}
