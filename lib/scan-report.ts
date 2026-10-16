import { latestScan, previewPages, scanFixes, scanIssues } from '@/lib/mock-data/scans';
import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { ScanReportScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the scanning agent's full report is
 * expected to produce. Used as a fallback when /api/scan-report has no real
 * result yet, and as a reference for the agent team's output format.
 */
export const mockScanReportResult: ScanReportScanResult = {
  scan: latestScan,
  issues: scanIssues,
  fixes: scanFixes,
  previewPages,
};

/**
 * Fetches the agent's latest full scan report (via /api/scan-report). Falls
 * back to mock data if the API has nothing yet or the request fails, so the
 * /scan page always renders.
 */
export async function getScanReport(): Promise<ScanReportScanResult> {
  return fetchJsonWithFallback('/api/scan-report', mockScanReportResult);
}
