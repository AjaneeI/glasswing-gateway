import { securityEvents, securityMetrics, securityPolicies } from '@/lib/mock-data/security';
import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { SecurityPoliciesScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the security-monitoring agent is
 * expected to produce. Used as a fallback when /api/security-policies has no
 * real result yet, and as a reference for the agent team's output format.
 */
export const mockSecurityPoliciesResult: SecurityPoliciesScanResult = {
  policies: securityPolicies,
  events: securityEvents,
  metrics: securityMetrics,
};

/**
 * Fetches the agent's latest security report (via /api/security-policies).
 * Shared by /security and the replay-detail sidebar. Falls back to mock data
 * if the API has nothing yet or the request fails.
 */
export async function getSecurityPoliciesReport(): Promise<SecurityPoliciesScanResult> {
  return fetchJsonWithFallback('/api/security-policies', mockSecurityPoliciesResult);
}
