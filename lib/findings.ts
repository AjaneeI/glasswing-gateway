import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import { findings as mockFindings } from '@/lib/mock-data/scans';
import type { Finding, FindingsScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the agent's top-findings report is
 * expected to produce. Used as a fallback when /api/findings has no real
 * scan result yet, and as a reference for the agent team's output format.
 */
export const mockFindingsResult: FindingsScanResult = {
  scanId: 'SCN-0025',
  scannedAt: '2026-09-26T11:42:00-04:00',
  findings: mockFindings,
};

/**
 * Fetches the agent's latest top-findings report (via /api/findings),
 * already ranked by impact. Falls back to mock data if the API has nothing
 * yet or the request fails, so the widget always renders.
 */
export async function getTopFindings(): Promise<Finding[]> {
  const result = await fetchJsonWithFallback('/api/findings', mockFindingsResult);
  return result.findings;
}
