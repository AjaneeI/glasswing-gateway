import { agents, sessionSummary, sessions } from '@/lib/mock-data/sessions';
import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { SessionsScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the session-monitoring agent is
 * expected to produce. Used as a fallback when /api/sessions has no real
 * result yet, and as a reference for the agent team's output format.
 */
export const mockSessionsResult: SessionsScanResult = {
  sessions,
  summary: sessionSummary,
  agents,
};

/**
 * Fetches the agent's latest session-monitoring report (via /api/sessions).
 * Shared by /sessions and /replays — both render the same list. Falls back
 * to mock data if the API has nothing yet or the request fails.
 */
export async function getSessionsReport(): Promise<SessionsScanResult> {
  return fetchJsonWithFallback('/api/sessions', mockSessionsResult);
}
