import { buildIntakeContext } from '@/lib/agent/intake';
import type { IntakeContext, ScanConfig, SwarmResponse } from '@/lib/agent/contracts';

/**
 * Client service layer for the two-stage agentic search.
 *
 * Stage 1 (intake): turn raw search input into a shared IntakeContext.
 * Stage 2 (swarm): fan the context out to multiple buyer agents.
 *
 * Both are plain fetch calls against same-origin routes, so swapping the
 * heuristic intake for a live LLM (or the orchestrator for a real multi-agent
 * service) requires no changes to the UI — only the endpoint implementation.
 */

export async function runIntake(query: string, config?: ScanConfig): Promise<IntakeContext> {
  try {
    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, config }),
    });
    if (!response.ok) throw new Error(`intake ${response.status}`);
    return (await response.json()) as IntakeContext;
  } catch {
    return buildIntakeContext(query, config);
  }
}

export async function runBuyerSwarm(
  context: IntakeContext,
  provider?: string,
): Promise<SwarmResponse> {
  const response = await fetch('/api/buyers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context, provider }),
  });
  if (!response.ok) throw new Error(`Buyer swarm failed (${response.status})`);
  return (await response.json()) as SwarmResponse;
}