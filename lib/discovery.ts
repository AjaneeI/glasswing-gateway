import { fetchJsonWithFallback, statusForScore } from '@/lib/readiness-utils';
import type { DiscoveryScanResult, ReadinessMetric } from '@/lib/types';

/**
 * Sample output shaped exactly like what the discoverability-scanning agent
 * is expected to produce. Used as a fallback when /api/discovery has no
 * real scan result yet, and as a reference for the agent team's output format.
 */
export const mockDiscoveryResult: DiscoveryScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  totalProducts: 72,
  discoverableProducts: 59,
  previousDiscoverablePercent: 77,
  categories: [
    { name: 'Backpacks', total: 24, discoverable: 22 },
    { name: 'Tents', total: 18, discoverable: 12 },
    { name: 'Footwear', total: 16, discoverable: 15 },
    { name: 'Accessories', total: 14, discoverable: 10 },
  ],
  issues: [
    {
      title: 'Variant metadata unclear',
      description: 'Backpack color and capacity variants are inconsistently represented.',
      affected: 143,
    },
  ],
};

/** Maps the discoverability agent's raw scan result onto the dashboard's ReadinessMetric shape. */
export function toReadinessMetric(result: DiscoveryScanResult): ReadinessMetric {
  const score = Math.round((result.discoverableProducts / result.totalProducts) * 100);
  const change =
    result.previousDiscoverablePercent !== undefined
      ? score - result.previousDiscoverablePercent
      : 0;
  return {
    name: 'Discovery',
    score,
    description: 'Products and content are findable by shopping agents.',
    status: statusForScore(score),
    icon: 'discovery',
    change,
    meta: {
      total: result.totalProducts,
      passing: result.discoverableProducts,
      unitLabel: 'products',
      breakdown: result.categories.map((c) => ({
        name: c.name,
        total: c.total,
        passing: c.discoverable,
      })),
    },
  };
}

/**
 * Fetches the latest discovery scan result from the agent (via /api/discovery)
 * and returns it as a ReadinessMetric. Falls back to mock data if the API
 * has nothing yet or the request fails, so the widget always renders.
 */
export async function getDiscoveryMetric(): Promise<ReadinessMetric> {
  const result = await fetchJsonWithFallback('/api/discovery', mockDiscoveryResult);
  return toReadinessMetric(result);
}
