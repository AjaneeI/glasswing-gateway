import { fetchJsonWithFallback, statusForScore } from '@/lib/readiness-utils';
import type { CompatibilityScanResult, ReadinessMetric } from '@/lib/types';

/**
 * Sample output shaped exactly like what the compatibility-scanning agent is
 * expected to produce. Used as a fallback when /api/compatibility has no
 * real scan result yet, and as a reference for the agent team's output
 * format.
 */
export const mockCompatibilityResult: CompatibilityScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  totalSignals: 30,
  compatibleSignals: 23,
  previousCompatiblePercent: 73,
  signals: [
    { name: 'Structured product data', total: 10, compatible: 9 },
    { name: 'Shipping policy markup', total: 6, compatible: 4 },
    { name: 'Returns policy markup', total: 6, compatible: 4 },
    { name: 'Checkout API schema', total: 8, compatible: 6 },
  ],
  issues: [
    {
      title: 'Ambiguous returns language',
      description: 'Return eligibility is visible to people but absent from machine-readable metadata.',
      affected: 98,
    },
  ],
};

/** Maps the compatibility agent's raw scan result onto the dashboard's ReadinessMetric shape. */
export function toReadinessMetric(result: CompatibilityScanResult): ReadinessMetric {
  const score = Math.round((result.compatibleSignals / result.totalSignals) * 100);
  const change =
    result.previousCompatiblePercent !== undefined
      ? score - result.previousCompatiblePercent
      : 0;
  return {
    name: 'Compatibility',
    score,
    description: 'Structured data and policies are mostly machine-readable.',
    status: statusForScore(score),
    icon: 'compatibility',
    change,
    meta: {
      total: result.totalSignals,
      passing: result.compatibleSignals,
      unitLabel: 'signals',
      breakdown: result.signals.map((s) => ({
        name: s.name,
        total: s.total,
        passing: s.compatible,
      })),
    },
  };
}

/**
 * Fetches the latest compatibility scan result from the agent (via
 * /api/compatibility) and returns it as a ReadinessMetric. Falls back to
 * mock data if the API has nothing yet or the request fails, so the widget
 * always renders.
 */
export async function getCompatibilityMetric(): Promise<ReadinessMetric> {
  const result = await fetchJsonWithFallback('/api/compatibility', mockCompatibilityResult);
  return toReadinessMetric(result);
}
