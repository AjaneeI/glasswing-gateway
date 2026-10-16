import { NextResponse } from 'next/server';
import { aggregateFindings } from '@/lib/agent/aggregate';
import { buyerPersonas, defaultGoals } from '@/lib/agent/personas';
import type { BuyerPersona } from '@/lib/agent/contracts';
import { runAgentScan } from '@/lib/agent/loop';
import { STOREFRONT_ORIGIN } from '@/lib/agent/storefront';
import { defaultProviderId, listProviders } from '@/lib/ai/providers';
import { buyersRequest } from '@/lib/agent/request-schemas';
import { readJson } from '@/lib/gateway/api';
import { requireOwner, apiError } from '@/lib/api/auth';
import { withExecutionBudget } from '@/lib/gateway/budget';

const depthCaps: Record<string, number> = { Quick: 3, Standard: 6, Deep: 12 };

// Buyer-swarm orchestrator. Fans a shared context out to multiple buyer
// personas running concurrently, then aggregates their results. Each persona
// is one buyer agent; wire them to distinct LLMs without changing this shape.
export async function POST(request: Request) {
  try {
    const owner = await requireOwner(request);
    const body = await readJson(request, buyersRequest);
    const provider = body.provider || defaultProviderId;
    const context = body.context;
    const personas = context?.personas?.length ? context.personas : buyerPersonas;
    const goals = context?.goals?.length ? context.goals : defaultGoals;
    const storefrontUrl = context?.storefrontUrl || STOREFRONT_ORIGIN;
    const maxJobs = depthCaps[context?.depth ?? 'Standard'] ?? 6;

    const jobs: { persona: BuyerPersona; goal: string }[] = [];
    outer: for (const persona of personas) {
      for (const goal of goals) {
        jobs.push({ persona, goal });
        if (jobs.length >= maxJobs) break outer;
      }
    }

    const results = await withExecutionBudget(
      owner,
      process.env.GATEWAY_MODEL_MODE === 'fixture',
      async () => {
        // Drain all started jobs before releasing the shared execution lock.
        const settled = await Promise.allSettled(
          jobs.map((job) => runAgentScan(job.goal, job.persona.name, provider, storefrontUrl)),
        );
        const failed = settled.find((result) => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        return settled.map(
          (result) =>
            (result as PromiseFulfilledResult<Awaited<ReturnType<typeof runAgentScan>>>).value,
        );
      },
    );
    const succeeded = results.filter((result) => result.success).length;
    const providerInfo = listProviders().find((item) => item.id === provider);

    return NextResponse.json(
      {
        provider,
        configured: Boolean(providerInfo?.configured),
        storefront: results[0]?.storefront ?? storefrontUrl,
        mode: results[0]?.mode ?? 'scripted',
        evidenceMode: results[0]?.evidenceMode ?? 'fixture',
        evaluationMode: 'shopper-self-report',
        model: results[0]?.model ?? null,
        goalCount: results.length,
        succeeded,
        failed: results.length - succeeded,
        personas,
        results,
        findings: aggregateFindings(results),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
