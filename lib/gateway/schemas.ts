import { z } from 'zod';
import { shopperInterests } from '../agent/interests';

const text = z.string().min(1).max(2000);
const refs = z.array(z.string().min(1)).min(1).max(30);
export const actionKind = z.enum([
  'navigate',
  'search',
  'inspect_product',
  // Checkout actions. Only usable on an environment that opted into checkout
  // testing; `fill_checkout` never touches a payment field.
  'add_to_cart',
  'view_cart',
  'begin_checkout',
  'fill_checkout',
  'stop',
]);
export const modeSchema = z.enum(['legitimate', 'constraint', 'red_team']);
export const provenanceSchema = z.strictObject({
  evidenceIds: refs,
  rationale: text,
  source: z.enum(['site_inference', 'merchant_edit']),
});
export const siteContextSchema = z.strictObject({
  merchantName: text,
  description: text,
  categories: z.array(text).max(20),
  claims: z
    .array(z.strictObject({ claim: text, evidenceIds: refs }))
    .min(1)
    .max(30),
  limitations: z.array(text).max(20),
});
export const archetypeSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: text,
  hypothesis: text,
  expertise: z.enum(['novice', 'intermediate', 'expert']),
  budgetSensitivity: z.enum(['low', 'medium', 'high']),
  comparisonDepth: z.enum(['shallow', 'moderate', 'deep']),
  patience: z.enum(['low', 'medium', 'high']),
  substitutionTolerance: z.enum(['none', 'low', 'high']),
  discoveryStrategy: z.enum(['search', 'browse', 'mixed']),
  provenance: provenanceSchema,
});
export const archetypesSchema = z.strictObject({
  archetypes: z.array(archetypeSchema).min(1).max(6),
});
export const constraintSchema = z.strictObject({
  kind: z.enum(['max_price', 'currency', 'text_contains', 'text_excludes']),
  value: text,
  description: text,
});
export const scenarioSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  archetypeId: z.string(),
  mode: modeSchema,
  goal: text,
  hardConstraints: z.array(constraintSchema).max(12),
  softPreferences: z.array(text).max(12),
  permittedActions: z.array(actionKind).min(1).max(8),
  authorizedStoppingPoint: z.literal('recommend_or_decline'),
  expectedOutcome: z.enum(['recommend', 'decline']),
  provenance: provenanceSchema,
});
export const scenariosSchema = z.strictObject({
  scenarios: z.array(scenarioSchema).min(3).max(12),
});
// All action fields are required for strict JSON Schema. Unused fields must be null.
export const actionSchema = z.strictObject({
  type: actionKind,
  url: z.string().max(2048).nullable(),
  query: z.string().max(200).nullable(),
  disposition: z.enum(['recommend', 'decline']).nullable(),
  productObservationId: z.string().nullable(),
  reason: text,
});
export const decisionSchema = z.strictObject({ action: actionSchema });
export const verdictSchema = z.strictObject({
  verdict: z.enum(['pass', 'fail', 'inconclusive']),
  reason: text,
  evidenceIds: refs,
  constraintAssessments: z
    .array(
      z.strictObject({
        constraintIndex: z.number().int().nonnegative(),
        verdict: z.enum(['satisfied', 'violated', 'unknown']),
        reason: text,
      }),
    )
    .max(12),
});
export const summarySchema = z.strictObject({ title: text, summary: text });
export const reviewSchema = z.strictObject({
  revision: z.number().int().positive(),
  archetypes: z.array(archetypeSchema).min(1).max(6),
  scenarios: z.array(scenarioSchema).min(3).max(12),
  approved: z.boolean(),
});
export const inspectRequestSchema = z.strictObject({
  merchantUrl: z.string().url().max(2048),
  environmentId: z.string().min(1).max(80),
  shopperInterests: z
    .array(z.enum(shopperInterests.map((item) => item.id)))
    .max(6)
    .optional(),
});
export const scanRequestSchema = z.strictObject({
  draftId: z.string().uuid(),
  revision: z.number().int().positive(),
});

export type SiteContext = z.infer<typeof siteContextSchema>;
export type Archetype = z.infer<typeof archetypeSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Action = z.infer<typeof actionSchema>;
export type SemanticVerdict = z.infer<typeof verdictSchema>;
export interface Observation {
  screenshotAvailable?: boolean;
  id: string;
  timestamp: string;
  url: string;
  title: string;
  text: string;
  links: { url: string; text: string }[];
  products: { name: string; price: number | null; currency: string | null }[];
  kind: 'page' | 'product';
}
export interface ModelCall {
  id: string;
  purpose: string;
  model: string;
  promptVersion: string;
  fixture: boolean;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  costBasis: 'configured_rates' | 'not_configured' | 'unavailable_usage' | 'fixture';
  status: 'completed' | 'failed';
  errorCode?: string;
}
export interface Draft {
  /** Absent on historical drafts, which must be reinspected before execution. */
  environmentPolicy?: string;
  checkoutEnabled?: boolean;
  shopperInterests?: string[];
  id: string;
  ownerId: string;
  createdAt: string;
  merchantUrl: string;
  environmentId: string;
  fixture: boolean;
  revision: number;
  approvedAt: string | null;
  evidence: Observation[];
  context: SiteContext;
  archetypes: Archetype[];
  scenarios: Scenario[];
  modelCalls: ModelCall[];
}
export interface TraceEvent {
  id: string;
  sequence: number;
  timestamp: string;
  action: Action | null;
  observation: Observation | null;
  status: 'observed' | 'executed' | 'blocked' | 'error';
  detail: string;
}
export interface Check {
  name: string;
  result: 'pass' | 'fail' | 'unknown';
  detail: string;
}
export interface Evaluation {
  outcome: 'passed' | 'failed' | 'inconclusive';
  deterministic: Check[];
  semantic: SemanticVerdict;
}
export interface Session {
  id: string;
  scanId: string;
  scenario: Scenario;
  archetype: Archetype;
  fixture: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt: string | null;
  completedAt: string | null;
  trace: TraceEvent[];
  modelCalls: ModelCall[];
  evaluation: Evaluation | null;
  error: ReturnType<typeof import('./errors').publicError> | null;
}
export interface Finding {
  id: string;
  sessionId: string;
  severity: 'high' | 'medium' | 'info';
  category: 'boundary' | 'goal' | 'uncertainty' | 'execution';
  title: string;
  summary: string;
  evidenceIds: string[];
  summarySource: 'deterministic' | 'model';
}
export interface Scan {
  categoryReports?: import('./readiness').CategoryReport[];
  id: string;
  ownerId: string;
  draft: Draft;
  fixture: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  runtimeId: string | null;
  sessions: Session[];
  findings: Finding[];
  modelCalls: ModelCall[];
}
