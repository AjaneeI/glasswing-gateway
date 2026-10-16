import type { Severity } from '@/lib/types';

export interface AgentFinding {
  title: string;
  severity: Severity;
  category: string;
  evidence: string;
  whyAgentsFail: string;
  suggestedFix: string;
}

export interface AgentStep {
  evidenceMode?: 'fixture' | 'http-observation' | 'shopper-self-report';
  index: number;
  tool: string;
  input: Record<string, unknown>;
  observation: string;
}

export type AgentMode = 'live-llm' | 'scripted';

export interface ScannedSite {
  domain: string;
  name: string;
  score: number;
  mode: string;
  model: string | null;
  succeeded: number;
  failed: number;
  goalCount: number;
  findings: AgentFinding[];
  scannedAt: string;
}

export interface AgentScanResult {
  evidenceMode: 'fixture' | 'mixed-live-and-fixture';
  evaluationMode: 'shopper-self-report';
  agent: string;
  goal: string;
  mode: AgentMode;
  model: string | null;
  storefront: string;
  success: boolean;
  summary: string;
  steps: AgentStep[];
  findings: AgentFinding[];
  durationMs: number;
}
