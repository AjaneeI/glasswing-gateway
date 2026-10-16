import { fetchJsonWithFallback, statusForScore } from '@/lib/readiness-utils';
import type { CheckoutScanResult, ReadinessMetric } from '@/lib/types';

/**
 * Sample output shaped exactly like what the checkout-scanning agent is
 * expected to produce. Used as a fallback when /api/checkout has no real
 * scan result yet, and as a reference for the agent team's output format.
 */
export const mockCheckoutResult: CheckoutScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  totalFlows: 25,
  completableFlows: 17,
  previousCompletablePercent: 65,
  flows: [
    { name: 'Guest checkout', total: 8, completable: 6 },
    { name: 'Signed-in checkout', total: 8, completable: 6 },
    { name: 'Saved payment method', total: 5, completable: 3 },
    { name: 'Gift order', total: 4, completable: 2 },
  ],
  issues: [
    {
      title: 'Confirmation missing for purchases above $250',
      description: 'The checkout flow can proceed without explicit customer confirmation.',
      affected: 3,
    },
  ],
};

/** Maps the checkout agent's raw scan result onto the dashboard's ReadinessMetric shape. */
export function toReadinessMetric(result: CheckoutScanResult): ReadinessMetric {
  const score = Math.round((result.completableFlows / result.totalFlows) * 100);
  const change =
    result.previousCompletablePercent !== undefined
      ? score - result.previousCompletablePercent
      : 0;
  return {
    name: 'Checkout',
    score,
    description: 'Agents can complete purchases, with some friction.',
    status: statusForScore(score),
    icon: 'checkout',
    change,
    meta: {
      total: result.totalFlows,
      passing: result.completableFlows,
      unitLabel: 'flows',
      breakdown: result.flows.map((f) => ({
        name: f.name,
        total: f.total,
        passing: f.completable,
      })),
    },
  };
}

/**
 * Fetches the latest checkout scan result from the agent (via /api/checkout)
 * and returns it as a ReadinessMetric. Falls back to mock data if the API
 * has nothing yet or the request fails, so the widget always renders.
 */
export async function getCheckoutMetric(): Promise<ReadinessMetric> {
  const result = await fetchJsonWithFallback('/api/checkout', mockCheckoutResult);
  return toReadinessMetric(result);
}
