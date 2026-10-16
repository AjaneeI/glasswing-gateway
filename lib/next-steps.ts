import { recommendations as mockRecommendations } from '@/lib/mock-data/recommendations';
import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { NextStepsScanResult, Recommendation } from '@/lib/types';

/**
 * Sample output shaped exactly like what the agent's recommended-next-steps
 * report is expected to produce: the highest-value fixes, benchmarked
 * against comparable well-executed merchant sites. Used as a fallback when
 * /api/next-steps has no real result yet, and as a reference for the agent
 * team's output format.
 */
export const mockNextStepsResult: NextStepsScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  recommendations: mockRecommendations,
};

/**
 * Fetches the agent's latest recommended next steps (via /api/next-steps),
 * ranked by impact. Falls back to mock data if the API has nothing yet or
 * the request fails, so the widget always renders.
 */
export async function getNextSteps(): Promise<Recommendation[]> {
  const result = await fetchJsonWithFallback('/api/next-steps', mockNextStepsResult);
  return result.recommendations;
}
