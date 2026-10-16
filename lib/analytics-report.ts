import { agentDistribution, failureModes, getAnalyticsData } from '@/lib/mock-data/analytics';
import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { AnalyticsScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the analytics agent is expected to
 * produce: all three range windows computed up front. Used as a fallback
 * when /api/analytics has no real result yet, and as a reference for the
 * agent team's output format.
 */
export const mockAnalyticsResult: AnalyticsScanResult = {
  ranges: {
    '7d': getAnalyticsData('7d'),
    '30d': getAnalyticsData('30d'),
    '90d': getAnalyticsData('90d'),
  },
  agentDistribution,
  failureModes,
};

/**
 * Fetches the agent's latest analytics report (via /api/analytics). Falls
 * back to mock data if the API has nothing yet or the request fails, so the
 * /analytics page always renders.
 */
export async function getAnalyticsReport(): Promise<AnalyticsScanResult> {
  return fetchJsonWithFallback('/api/analytics', mockAnalyticsResult);
}
