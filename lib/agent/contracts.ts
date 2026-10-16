import type { AgentFinding, AgentScanResult } from './types';

/**
 * A synthetic buyer persona. The intake stage decides which personas run
 * against a storefront; the swarm orchestrator runs one agent per persona.
 * These are configs today but map 1:1 onto distinct LLM buyer agents.
 */
export interface BuyerPersona {
  id: string;
  name: string;
  short: string;
  color: string;
  goalBias: string;
  budgetStrictness: 'strict' | 'flexible';
  patience: 'low' | 'medium' | 'high';
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Shared context produced by the intake stage and consumed by every buyer
 * agent in the swarm. This is the single integration seam: an intake LLM
 * fills it in, and N buyer LLMs read from it.
 */
export interface IntakeContext {
  interests?: string[];
  storefrontUrl: string;
  storefrontLabel: string;
  category: string;
  region: string;
  currency: string;
  environment: string;
  depth: string;
  budget: number;
  focus: string[];
  guardrails: string[];
  constraints: string[];
  goals: string[];
  personas: BuyerPersona[];
  source: 'heuristic' | 'llm';
}

/**
 * Structured scan brief chosen by the user before searching. Populates the
 * IntakeContext so the intake agent (and every buyer agent) starts from an
 * explicit brief instead of guessing from free text.
 */
export interface ScanConfig {
  interests?: string[];
  focuses: string[];
  personaIds: string[];
  budget: number;
  region: string;
  currency: string;
  environment: string;
  depth: string;
  guardrails: string[];
}

/** Request/response contract for the buyer-swarm endpoint. */
export interface SwarmResponse {
  evidenceMode: 'fixture' | 'mixed-live-and-fixture';
  evaluationMode: 'shopper-self-report';
  provider: string;
  configured: boolean;
  storefront: string;
  mode: string;
  model: string | null;
  goalCount: number;
  succeeded: number;
  failed: number;
  personas: BuyerPersona[];
  results: AgentScanResult[];
  findings: AgentFinding[];
}
