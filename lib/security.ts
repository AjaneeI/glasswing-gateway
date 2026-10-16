import { fetchJsonWithFallback, statusForScore } from '@/lib/readiness-utils';
import type { ReadinessMetric, SecurityScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the security-scanning agent is
 * expected to produce. Used as a fallback when /api/security has no real
 * scan result yet, and as a reference for the agent team's output format.
 */
export const mockSecurityResult: SecurityScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  totalPolicies: 18,
  enforcedPolicies: 11,
  previousEnforcedPercent: 59,
  policies: [
    { name: 'Agent identity verification', total: 5, enforced: 2 },
    { name: 'Purchase confirmation thresholds', total: 4, enforced: 2 },
    { name: 'Rate limiting', total: 5, enforced: 4 },
    { name: 'Session integrity', total: 4, enforced: 3 },
  ],
  issues: [
    {
      title: 'No verified agent identity policy',
      description: 'Authenticated shopping agents are indistinguishable from generic automation.',
      affected: 82,
    },
  ],
};

/** Maps the security agent's raw scan result onto the dashboard's ReadinessMetric shape. */
export function toReadinessMetric(result: SecurityScanResult): ReadinessMetric {
  const score = Math.round((result.enforcedPolicies / result.totalPolicies) * 100);
  const change =
    result.previousEnforcedPercent !== undefined ? score - result.previousEnforcedPercent : 0;
  return {
    name: 'Security',
    score,
    description: 'Intent controls and abuse protections need improvement.',
    status: statusForScore(score),
    icon: 'security',
    change,
    meta: {
      total: result.totalPolicies,
      passing: result.enforcedPolicies,
      unitLabel: 'policies',
      breakdown: result.policies.map((p) => ({
        name: p.name,
        total: p.total,
        passing: p.enforced,
      })),
    },
  };
}

/**
 * Fetches the latest security scan result from the agent (via /api/security)
 * and returns it as a ReadinessMetric. Falls back to mock data if the API
 * has nothing yet or the request fails, so the widget always renders.
 */
export async function getSecurityMetric(): Promise<ReadinessMetric> {
  const result = await fetchJsonWithFallback('/api/security', mockSecurityResult);
  return toReadinessMetric(result);
}
