import { z } from 'zod';
const text = z.string().min(1).max(2000);
const labels = z.array(z.string().max(120)).max(20);
const persona = z.strictObject({
  id: z.string().max(80),
  name: z.string().max(100),
  short: z.string().max(40),
  color: z.string().max(40),
  goalBias: text,
  budgetStrictness: z.enum(['strict', 'flexible']),
  patience: z.enum(['low', 'medium', 'high']),
  riskTolerance: z.enum(['low', 'medium', 'high']),
});
const settings = {
  interests: labels.optional(),
  budget: z.number().finite().min(0).max(10000),
  region: z.enum(['US', 'EU', 'Global']),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  environment: z.enum(['Production', 'Staging']),
  depth: z.enum(['Quick', 'Standard', 'Deep']),
  guardrails: labels,
};
export const intakeRequest = z.strictObject({
  query: z.string().max(4000).default(''),
  config: z.strictObject({ ...settings, focuses: labels, personaIds: labels }).optional(),
});
export const buyersRequest = z.strictObject({
  provider: z.enum(['openai', 'sciforium', 'custom']).optional(),
  context: z
    .strictObject({
      ...settings,
      storefrontUrl: z.string().url().max(2048),
      storefrontLabel: text,
      category: text,
      focus: labels,
      constraints: z.array(text).max(30),
      goals: z.array(z.string().min(1).max(4000)).min(1).max(12),
      personas: z.array(persona).min(1).max(6),
      source: z.enum(['heuristic', 'llm']),
    })
    .optional(),
});
