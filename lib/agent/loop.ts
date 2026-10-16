import { chatWithTools, type ChatMessage, type LlmConfig } from '@/lib/ai/client';
import { resolveProvider } from '@/lib/ai/providers';
import { STOREFRONT_ORIGIN, catalog, knownFailureTemplates } from './storefront';
import { agentTools, executeTool, toolEvidenceMode, type AgentReport } from './tools';
import type { AgentScanResult, AgentStep } from './types';
import { executionSignal } from '../gateway/budget';
import { GatewayError } from '../gateway/errors';

const MAX_STEPS = 10;

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function systemPrompt(storefrontUrl: string): string {
  return `You are an autonomous shopping agent evaluating a merchant storefront on behalf of the Gateway readiness platform.

Your job is to genuinely attempt a shopping goal against the storefront the way a real agent would, observe what breaks, and report it.

Storefront under test: ${storefrontUrl}

Evidence warning: only fetch_page can read authorized live pages. Catalog,
structured-data, policy and checkout tools are synthetic fixtures, never facts
about this merchant. Label their source and never claim a real purchase.
Your final success flag is a legacy self-report, not an independent evaluation.

Rules:
- Use the provided tools to inspect pages, structured data, policies, and to attempt checkout.
- Reason step by step. Decide what to inspect based on the goal.
- Only purchase within the goal's budget. Never silently downgrade a requested product configuration.
- When you cannot complete the goal, capture exactly why an autonomous agent would fail.
- Finish by calling submit_report with a concise summary, whether the goal succeeded, and every blocking finding. Severity must be one of Critical, High, Medium, Low.`;
}

function runLiveAgent(
  goal: string,
  config: LlmConfig,
  storefrontUrl: string,
): Promise<{ report: AgentReport | null; steps: AgentStep[] }> {
  return (async () => {
    const steps: AgentStep[] = [];
    let report: AgentReport | null = null;
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(storefrontUrl) },
      { role: 'user', content: `Shopping goal: ${goal}` },
    ];
    for (let i = 0; i < MAX_STEPS; i += 1) {
      executionSignal().throwIfAborted();
      const message = await chatWithTools(config, messages, agentTools);
      messages.push(message);
      if (!message.tool_calls?.length) break;
      if (message.tool_calls.length > 8)
        throw new GatewayError(
          'MODEL_TOOL_LIMIT',
          'A model turn may request at most eight tools.',
          502,
        );
      for (const call of message.tool_calls) {
        executionSignal().throwIfAborted();
        const args = parseArgs(call.function.arguments);
        const result = await executeTool(call.function.name, args);
        const evidenceMode = toolEvidenceMode(call.function.name, args);
        const observation = JSON.stringify({ evidenceMode, observation: result.observation });
        steps.push({
          evidenceMode,
          index: steps.length + 1,
          tool: call.function.name,
          input: args,
          observation,
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: observation,
        });
        if (result.report) report = result.report;
      }
      if (report) break;
    }
    return { report, steps };
  })();
}

function budgetFromGoal(goal: string): number {
  const match = goal.match(/\$?\s?(\d{2,5})/);
  return match ? Number(match[1]) : 250;
}

async function runScriptedAgent(
  goal: string,
): Promise<{ report: AgentReport; steps: AgentStep[] }> {
  const steps: AgentStep[] = [];
  const record = async (tool: string, input: Record<string, unknown>) => {
    const result = await executeTool(tool, input);
    steps.push({
      index: steps.length + 1,
      tool,
      input,
      observation: result.observation,
      evidenceMode: 'fixture',
    });
    return result;
  };

  const budget = budgetFromGoal(goal);
  const keyword = /jacket/i.test(goal) ? 'jacket' : /tent/i.test(goal) ? 'tent' : 'backpack';

  const search = await record('search_products', { query: keyword });
  const matches = JSON.parse(search.observation) as {
    name: string;
    sku: string;
    price: number;
    rating: number;
    variants: unknown[];
  }[];
  const affordable = matches
    .filter((item) => item.price <= budget)
    .sort((a, b) => b.rating - a.rating);
  const chosen = affordable[0] ?? matches[0];

  const findings: (typeof knownFailureTemplates)[number]['finding'][] = [];

  let success = false;
  let summary = '';

  if (!chosen) {
    summary = `No product matched the goal "${goal}".`;
  } else {
    const hasVariants = Array.isArray(chosen.variants) && chosen.variants.length > 0;
    const checkoutSku = hasVariants ? `${chosen.sku}-FOR` : chosen.sku;
    const checkout = await record('attempt_checkout', {
      sku: checkoutSku,
      quantity: 1,
      max_spend: budget,
    });
    const checkoutResult = JSON.parse(checkout.observation) as { ok: boolean; reason: string };
    success = checkoutResult.ok;
    if (hasVariants) findings.push(knownFailureTemplates[0].finding);
    summary = success
      ? `Agent selected ${chosen.name} and completed a simulated purchase within the $${budget} budget.`
      : `Agent selected ${chosen.name} but could not complete the purchase: ${checkoutResult.reason}`;
  }

  await record('get_policy', { type: 'shipping' });
  await record('get_policy', { type: 'returns' });
  await record('fetch_page', {
    url: `${STOREFRONT_ORIGIN}/products/${catalog.find((p) => p.sku === chosen?.sku)?.slug ?? ''}`,
  });
  findings.push(
    knownFailureTemplates[1].finding,
    knownFailureTemplates[2].finding,
    knownFailureTemplates[3].finding,
  );

  return { report: { summary, success, findings }, steps };
}

export async function runAgentScan(
  goal: string,
  agentName: string,
  providerId?: string,
  storefrontUrl: string = STOREFRONT_ORIGIN,
): Promise<AgentScanResult> {
  const started = Date.now();
  const fixture = process.env.GATEWAY_MODEL_MODE === 'fixture';
  const config = fixture ? null : resolveProvider(providerId);
  if (!fixture && !config)
    throw new GatewayError(
      'CONFIGURATION_ERROR',
      'Configure the selected provider or explicitly select fixture mode.',
      503,
    );
  if (config) {
    try {
      const { report, steps } = await runLiveAgent(goal, config, storefrontUrl);
      return {
        agent: agentName,
        goal,
        mode: 'live-llm',
        evidenceMode: 'mixed-live-and-fixture',
        evaluationMode: 'shopper-self-report',
        model: config.model,
        storefront: storefrontUrl,
        success: report?.success ?? false,
        summary:
          'Legacy mixed-evidence self-report (catalog/policy/checkout tools are synthetic fixtures): ' +
          (report?.summary ?? 'Agent completed without submitting a report.'),
        steps,
        findings: report?.findings ?? [],
        durationMs: Date.now() - started,
      };
    } catch (error) {
      // A failed live run is a failure; never replace it with a scripted success.
      throw error;
    }
  }
  const scripted = await runScriptedAgent(goal);
  return {
    agent: agentName,
    goal,
    mode: 'scripted',
    evidenceMode: 'fixture',
    evaluationMode: 'shopper-self-report',
    model: null,
    storefront: STOREFRONT_ORIGIN,
    success: scripted.report.success,
    summary: scripted.report.summary,
    steps: scripted.steps,
    findings: scripted.report.findings,
    durationMs: Date.now() - started,
  };
}
