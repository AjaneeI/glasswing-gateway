import type { ToolDefinition } from '@/lib/ai/client';
import {
  STOREFRONT_HOST,
  attemptCheckout,
  catalog,
  extractStructuredData,
  getPolicy,
  resolvePage,
} from './storefront';
import type { AgentFinding } from './types';
import { environments } from '../gateway/config';
import { allowedUrl, pinnedHost, readResource } from '../gateway/browser';
import { executionSignal } from '../gateway/budget';

export interface AgentReport {
  summary: string;
  success: boolean;
  findings: AgentFinding[];
}

export const agentTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_page',
      description:
        'Read a fixture page or a server-configured, authorized read-only storefront URL.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute URL to fetch.' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_structured_data',
      description:
        'Return synthetic fixture structured data. This is not evidence about the requested live merchant.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute URL to inspect.' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search only the synthetic fixture catalog, not the live merchant catalog.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keyword, e.g. backpack or jacket.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_policy',
      description: 'Read synthetic fixture shipping/returns policies, not live merchant policies.',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', description: 'Policy type: shipping or returns.' } },
        required: ['type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attempt_checkout',
      description:
        'Simulate a checkout in the synthetic fixture only. Never places an order or establishes live merchant purchase success.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'SKU to purchase.' },
          quantity: { type: 'integer', description: 'Quantity, default 1.' },
          max_spend: { type: 'number', description: 'Maximum authorized spend in USD.' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_report',
      description:
        'Finish the evaluation by submitting the final structured report of what happened and every agent-blocking finding discovered.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          success: { type: 'boolean', description: 'Whether the shopping goal succeeded.' },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
                category: { type: 'string' },
                evidence: { type: 'string' },
                whyAgentsFail: { type: 'string' },
                suggestedFix: { type: 'string' },
              },
              required: [
                'title',
                'severity',
                'category',
                'evidence',
                'whyAgentsFail',
                'suggestedFix',
              ],
            },
          },
        },
        required: ['summary', 'success', 'findings'],
      },
    },
  },
];

export function toolEvidenceMode(name: string, args: Record<string, unknown>) {
  if (name === 'submit_report') return 'shopper-self-report' as const;
  if (name === 'fetch_page') {
    try {
      if (new URL(String(args.url)).hostname !== STOREFRONT_HOST)
        return 'http-observation' as const;
    } catch {}
  }
  return 'fixture' as const;
}

async function fetchRemote(url: string): Promise<string> {
  const env = environments().find((item) => item.origin === new URL(url).origin);
  if (!env) throw new Error('Destination is not an authorized storefront.');
  // Legacy tools never receive checkout authority, even on an opted-in environment.
  const target = allowedUrl(url, { ...env, checkout: undefined });
  const response = await readResource(
    target,
    await pinnedHost(env),
    {},
    'GET',
    AbortSignal.any([AbortSignal.timeout(8000), executionSignal()]),
  );
  return `HTTP ${response.status}\n\n${response.body.toString('utf8').slice(0, 6000)}`;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ observation: string; report?: AgentReport }> {
  switch (name) {
    case 'fetch_page': {
      const url = String(args.url ?? '');
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        return { observation: `Invalid URL: ${url}` };
      }
      if (host === STOREFRONT_HOST) {
        const page = resolvePage(url);
        if (!page) return { observation: `No route for ${url}` };
        return { observation: `HTTP ${page.status}\n\n${page.body.slice(0, 6000)}` };
      }
      try {
        return { observation: await fetchRemote(url) };
      } catch (error) {
        return {
          observation: `Fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        };
      }
    }
    case 'extract_structured_data': {
      const url = String(args.url ?? '');
      const data = extractStructuredData(url);
      if (!data.length) return { observation: 'No structured data found on this URL.' };
      return { observation: JSON.stringify(data, null, 2) };
    }
    case 'search_products': {
      const query = String(args.query ?? '').toLowerCase();
      const matches = catalog.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query),
      );
      if (!matches.length) return { observation: `No products matched "${query}".` };
      return {
        observation: JSON.stringify(
          matches.map((item) => ({
            name: item.name,
            sku: item.sku,
            price: item.price,
            rating: item.rating,
            category: item.category,
            url: `/products/${item.slug}`,
            variants: item.variants,
          })),
          null,
          2,
        ),
      };
    }
    case 'get_policy': {
      const policy = getPolicy(String(args.type ?? ''));
      if (!policy) return { observation: `Unknown policy type "${args.type}".` };
      return { observation: JSON.stringify(policy, null, 2) };
    }
    case 'attempt_checkout': {
      const result = attemptCheckout(
        String(args.sku ?? ''),
        Number(args.quantity ?? 1),
        Number(args.max_spend ?? 0),
      );
      return { observation: JSON.stringify(result, null, 2) };
    }
    case 'submit_report': {
      const findings = Array.isArray(args.findings) ? (args.findings as AgentFinding[]) : [];
      return {
        observation: 'Report received.',
        report: {
          summary: String(args.summary ?? ''),
          success: Boolean(args.success),
          findings,
        },
      };
    }
    default:
      return { observation: `Unknown tool "${name}".` };
  }
}
