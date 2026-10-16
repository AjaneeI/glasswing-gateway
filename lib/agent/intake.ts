import { buyerPersonas, defaultGoals, storefrontOrigin } from './personas';
import type { IntakeContext, ScanConfig } from './contracts';
import { shopperInterests } from './interests';

export const focusOptions = [
  'Discovery',
  'Checkout',
  'Promotions',
  'Policy compliance',
  'Variants & compatibility',
  'Inventory & availability',
  'Pricing accuracy',
];

export const guardrailOptions = [
  'Autonomous checkout allowed',
  'Confirm above $250',
  'Block promo abuse',
  'Verified agent identity',
];

export const budgetBands = [
  { label: 'Under $100', value: 100 },
  { label: 'Under $250', value: 250 },
  { label: 'Under $500', value: 500 },
  { label: 'No limit', value: 10000 },
];

export const regions = ['US', 'EU', 'Global'];
export const currencies = ['USD', 'EUR', 'GBP'];
export const environments = ['Production', 'Staging'];
export const scanDepths = ['Quick', 'Standard', 'Deep'];

export const defaultScanConfig: ScanConfig = {
  interests: [],
  focuses: ['Discovery', 'Checkout'],
  personaIds: buyerPersonas.map((persona) => persona.id),
  budget: 250,
  region: 'US',
  currency: 'USD',
  environment: 'Production',
  depth: 'Standard',
  guardrails: ['Block promo abuse', 'Verified agent identity'],
};

function normalizeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Normalizes free-text search input + the user's scan brief into the shared
 * buyer context.
 *
 * This is the intake seam: today it is a deterministic parser, but the same
 * signature can be backed by an intake LLM that asks clarifying questions and
 * emits the same IntakeContext. Nothing downstream changes when that happens.
 */
export async function buildIntakeContext(
  query: string,
  config: ScanConfig = defaultScanConfig,
): Promise<IntakeContext> {
  const trimmed = query.trim();
  const urlMatch = trimmed.match(/((https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(?:\/\S*)?)/i);
  const storefrontUrl = urlMatch ? normalizeUrl(urlMatch[0]) : storefrontOrigin;
  const storefrontLabel = storefrontUrl.replace(/^https?:\/\//i, '');
  const budgetMatch = trimmed.match(/\$\s?(\d{2,5})|(\d{2,5})\s?(?:dollars|budget)/i);
  const budget = budgetMatch ? Number(budgetMatch[1] ?? budgetMatch[2]) : config.budget;
  const category = /apparel|jacket|clothing/i.test(trimmed)
    ? 'Apparel'
    : /backpack|pack|daypack/i.test(trimmed)
      ? 'Backpacks'
      : /tent|camp/i.test(trimmed)
        ? 'Camping'
        : /shoe|boot|footwear/i.test(trimmed)
          ? 'Footwear'
          : /bottle|accessor/i.test(trimmed)
            ? 'Accessories'
            : 'General';
  const rest = urlMatch ? trimmed.replace(urlMatch[0], '').trim() : trimmed;
  const interests = shopperInterests.filter((interest) => config.interests?.includes(interest.id));
  const goals =
    urlMatch && rest.length < 4
      ? interests.length
        ? interests.map(
            (interest) =>
              `${interest.goal} within ${config.currency} ${budget}. Only choose products supported by the store's catalog; report when no suitable option exists.`,
          )
        : defaultGoals
      : [trimmed];
  const personas = config.personaIds.length
    ? buyerPersonas.filter((persona) => config.personaIds.includes(persona.id))
    : buyerPersonas;
  const constraints = [
    ...interests.map((interest) => `Shopper interest: ${interest.label}`),
    `Focus: ${config.focuses.join(', ') || 'General readiness'}`,
    `Depth: ${config.depth}`,
    `Budget ≤ ${config.currency} ${budget}`,
    `Region: ${config.region}`,
    `Environment: ${config.environment}`,
    ...config.guardrails.map((guardrail) => `Guardrail: ${guardrail}`),
  ];
  return {
    interests: interests.map((interest) => interest.id),
    storefrontUrl,
    storefrontLabel,
    category,
    region: config.region,
    currency: config.currency,
    environment: config.environment,
    depth: config.depth,
    budget,
    focus: config.focuses,
    guardrails: config.guardrails,
    constraints,
    goals,
    personas: personas.length ? personas : buyerPersonas,
    source: 'heuristic',
  };
}
