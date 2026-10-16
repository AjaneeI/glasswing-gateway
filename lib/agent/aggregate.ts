import type { Severity } from '@/lib/types';
import type { AgentFinding, AgentScanResult } from './types';

const order: Record<Severity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/**
 * Merges findings reported by every buyer agent into one panel view:
 * deduplicates by title and keeps the highest severity seen.
 */
export function aggregateFindings(results: AgentScanResult[]): AgentFinding[] {
  const byTitle = new Map<string, AgentFinding>();
  for (const result of results) {
    for (const finding of result.findings) {
      const existing = byTitle.get(finding.title);
      if (!existing || order[finding.severity] < order[existing.severity]) {
        byTitle.set(finding.title, finding);
      }
    }
  }
  return [...byTitle.values()].sort((a, b) => order[a.severity] - order[b.severity]);
}