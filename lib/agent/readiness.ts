import type { AgentFinding } from './types';

const weights: Record<string, number> = { Critical: 15, High: 8, Medium: 4, Low: 2 };

export function computeReadiness(findings: AgentFinding[]): number {
  const seen = new Set<string>();
  let penalty = 0;
  for (const finding of findings) {
    if (seen.has(finding.title)) continue;
    seen.add(finding.title);
    penalty += weights[finding.severity] ?? 3;
  }
  return Math.max(18, Math.min(98, 100 - penalty));
}

export function siteNameFromDomain(domain: string): string {
  const host = domain.replace(/^https?:\/\//i, '').split('/')[0];
  const core = host.replace(/^www\./i, '').split('.')[0];
  return core.charAt(0).toUpperCase() + core.slice(1);
}

export function hostFromDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').split('/')[0];
}