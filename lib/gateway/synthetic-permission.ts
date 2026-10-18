/** Opt-in synthetic tool contract for the trusted Gateway host; not an ACS adapter. */
import { z } from 'zod';

const operation = z.enum(['read', 'append']);
const resource = z.enum(['scratch', 'protected', 'review']);
const decision = z.enum(['allow', 'deny', 'approval_required']);
const argumentsSchema = z.strictObject({
  operation,
  resource,
  note: z.string().max(512).default(''),
});
export const syntheticRequestSchema = z.strictObject({
  tool: z.literal('synthetic_records'),
  arguments: argumentsSchema,
});
const ruleSchema = z.strictObject({
  tool: z.literal('synthetic_records'),
  operation,
  resource,
  decision,
});
const policySchema = z
  .array(ruleSchema)
  .max(6)
  .superRefine((rules, ctx) => {
    const keys = rules.map((rule) => `${rule.tool}:${rule.operation}:${rule.resource}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate policy rule' });
  });
export type SyntheticArguments = Readonly<z.infer<typeof argumentsSchema>>;
type SyntheticRequest = Readonly<{ tool: 'synthetic_records'; arguments: SyntheticArguments }>;
type Rule = Readonly<z.infer<typeof ruleSchema>>;
export interface SyntheticToolHost {
  policy: unknown;
  execute: (args: SyntheticArguments) => unknown | Promise<unknown>;
  evaluate?: (request: SyntheticRequest, policy: readonly Rule[]) => unknown;
}
export interface SyntheticResult {
  status: 'executed' | 'denied' | 'pending' | 'execution_error';
  reason: string;
  value?: unknown;
}

/** Host setup only. The producer receives the schema and description, never this configuration. */
export function createSyntheticDispatcher(host: SyntheticToolHost) {
  const parsed = policySchema.safeParse(host.policy);
  const policy = parsed.success
    ? Object.freeze(parsed.data.map((rule) => Object.freeze(rule)))
    : undefined;
  const policyError = host.policy == null ? 'policy_missing' : 'policy_invalid';
  const execute = host.execute;
  const evaluate =
    host.evaluate === undefined
      ? (request: SyntheticRequest, rules: readonly Rule[]) =>
          rules.find(
            (rule) =>
              rule.tool === request.tool &&
              rule.operation === request.arguments.operation &&
              rule.resource === request.arguments.resource,
          )?.decision ?? 'deny'
      : host.evaluate;

  return async (raw: unknown, signal: AbortSignal): Promise<SyntheticResult> => {
    let request: SyntheticRequest;
    try {
      const validated = syntheticRequestSchema.safeParse(raw);
      if (!validated.success) return { status: 'denied', reason: 'request_invalid' };
      request = Object.freeze({
        tool: validated.data.tool,
        arguments: Object.freeze(validated.data.arguments),
      });
    } catch {
      return { status: 'denied', reason: 'request_invalid' };
    }
    if (!policy) return { status: 'denied', reason: policyError };
    if (typeof execute !== 'function') return { status: 'denied', reason: 'registry_invalid' };
    let verdict: unknown;
    try {
      signal.throwIfAborted();
      verdict = evaluate(request, policy);
      signal.throwIfAborted();
    } catch {
      return { status: 'denied', reason: 'evaluation_failed' };
    }
    if (!decision.safeParse(verdict).success)
      return { status: 'denied', reason: 'decision_invalid' };
    if (verdict === 'approval_required') return { status: 'pending', reason: 'approval_required' };
    if (verdict !== 'allow') return { status: 'denied', reason: 'policy_denied' };
    try {
      // Exactly the frozen argument object evaluated above; no reparse, rewrite, or retry.
      return { status: 'executed', reason: 'allowed', value: await execute(request.arguments) };
    } catch {
      return { status: 'execution_error', reason: 'callback_failed' };
    }
  };
}
