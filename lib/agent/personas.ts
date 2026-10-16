import { STOREFRONT_ORIGIN } from './storefront';
import type { BuyerPersona } from './contracts';

/**
 * Legacy behavioral persona labels, not distinct model/provider integrations.
 * IDs remain stable for saved selections; the active provider determines the model.
 */
export const buyerPersonas: BuyerPersona[] = [
  {
    id: 'openai',
    name: 'Rating-focused Shopper',
    short: 'O',
    color: 'emerald',
    goalBias: 'highest-rated option within budget',
    budgetStrictness: 'strict',
    patience: 'medium',
    riskTolerance: 'low',
  },
  {
    id: 'gemini',
    name: 'Specification Comparer',
    short: 'G',
    color: 'blue',
    goalBias: 'specification-heavy comparison',
    budgetStrictness: 'strict',
    patience: 'high',
    riskTolerance: 'low',
  },
  {
    id: 'synthetic',
    name: 'Discount Seeker',
    short: 'S',
    color: 'violet',
    goalBias: 'promotion and discount seeking',
    budgetStrictness: 'flexible',
    patience: 'high',
    riskTolerance: 'medium',
  },
  {
    id: 'perplexity',
    name: 'Discovery Shopper',
    short: 'P',
    color: 'teal',
    goalBias: 'discovery and comparison breadth',
    budgetStrictness: 'flexible',
    patience: 'medium',
    riskTolerance: 'low',
  },
  {
    id: 'copilot',
    name: 'Speed-focused Shopper',
    short: 'C',
    color: 'blue',
    goalBias: 'fastest checkout path',
    budgetStrictness: 'strict',
    patience: 'low',
    riskTolerance: 'medium',
  },
];

export const defaultGoals = [
  'Find a hiking backpack under $250 and buy the best-rated option',
  'Buy an insulated jacket under $180',
];

export const storefrontOrigin = STOREFRONT_ORIGIN;
