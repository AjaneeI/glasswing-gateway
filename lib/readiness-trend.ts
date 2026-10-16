import { fetchJsonWithFallback } from '@/lib/readiness-utils';
import type { ReadinessTrendScanResult } from '@/lib/types';

/**
 * Sample output shaped exactly like what the agent is expected to produce
 * for the readiness-trend chart: the overall readiness score from the last 5
 * scans of a given website. Used as a fallback when /api/readiness-trend has
 * no real result yet, and as a reference for the agent team's output format.
 */
export const mockReadinessTrendResult: ReadinessTrendScanResult = {
  target: 80,
  points: [
    { label: 'Sep 02', date: '2026-09-02', score: 61 },
    { label: 'Sep 08', date: '2026-09-08', score: 64 },
    { label: 'Sep 14', date: '2026-09-14', score: 67 },
    { label: 'Sep 20', date: '2026-09-20', score: 70 },
    { label: 'Sep 26', date: '2026-09-26', score: 74 },
  ],
};

/** Shape the readiness-trend chart (recharts) actually renders: one point per scan. */
export interface ReadinessTrendChartPoint {
  name: string;
  score: number;
  target: number;
}

export function toChartData(result: ReadinessTrendScanResult): ReadinessTrendChartPoint[] {
  return result.points.map((p) => ({ name: p.label, score: p.score, target: result.target }));
}

/**
 * Fetches the merchant's last-5-scans readiness trend from the agent (via
 * /api/readiness-trend). Falls back to mock data if the API has nothing yet
 * or the request fails, so the widget always renders.
 */
export async function getReadinessTrend(): Promise<ReadinessTrendScanResult> {
  return fetchJsonWithFallback('/api/readiness-trend', mockReadinessTrendResult);
}
