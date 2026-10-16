import type { ConsumerPersona, DemandSignalRun, PersonaReaction, ProductUnderTest } from '@/lib/types';

export const productUnderTest: ProductUnderTest = {
  id: 'PUT-001',
  name: 'Summit Trail 45L Backpack',
  price: 199,
  description:
    'A versatile, all-weather backpack built for weekend escapes and multi-day trails.',
};

export const consumerPersonas: ConsumerPersona[] = [
  {
    id: 'PER-001',
    name: 'Dana Whitfield',
    segment: 'Outdoor beginner',
    age: 27,
    incomeBand: '$45k–$65k',
    priorPurchases: ['Trail running shoes', 'Basic tent'],
  },
  {
    id: 'PER-002',
    name: 'Marcus Reyes',
    segment: 'Budget-conscious parent',
    age: 38,
    incomeBand: '$60k–$85k',
    priorPurchases: ['Kids hiking boots', 'Family-size cooler'],
  },
  {
    id: 'PER-003',
    name: 'Priya Nandakumar',
    segment: 'Ultralight enthusiast',
    age: 31,
    incomeBand: '$90k–$120k',
    priorPurchases: ['Trailhead 28 daypack', 'Titanium cook set', 'Sub-1kg tent'],
  },
  {
    id: 'PER-004',
    name: 'Colin Baptiste',
    segment: 'Weekend car camper',
    age: 44,
    incomeBand: '$85k–$110k',
    priorPurchases: ['6-person tent', 'Camp chairs', 'Cooler'],
  },
  {
    id: 'PER-005',
    name: 'Sasha Grimwood',
    segment: 'Gear-obsessed hobbyist',
    age: 29,
    incomeBand: '$70k–$95k',
    priorPurchases: ['Alpine Pro 55', 'Merino base layers', 'GPS watch'],
  },
  {
    id: 'PER-006',
    name: 'Odalys Ferreira',
    segment: 'Eco-conscious minimalist',
    age: 34,
    incomeBand: '$55k–$75k',
    priorPurchases: ['Recycled-fiber jacket', 'Reusable water filter'],
  },
  {
    id: 'PER-007',
    name: 'Ben Achterberg',
    segment: 'Urban commuter hiker',
    age: 26,
    incomeBand: '$50k–$70k',
    priorPurchases: ['Commuter daypack', 'Packable rain shell'],
  },
  {
    id: 'PER-008',
    name: 'Lucia Moreno',
    segment: 'Gift buyer',
    age: 52,
    incomeBand: '$100k+',
    priorPurchases: ['Hiking poles (gift)', 'Wool socks (gift)'],
  },
];

export const personaReactions: PersonaReaction[] = [
  {
    personaId: 'PER-001',
    productId: 'PUT-001',
    verdict: 'Would consider',
    statedReasoning:
      'Looks well-made, but I’d want to know it’s not overkill for occasional weekend trips before I spend this much on my first real pack.',
    priceSensitivity: 'Fair',
    objections: ['Worried it’s too advanced a pack for a first-time hiker'],
  },
  {
    personaId: 'PER-002',
    productId: 'PUT-001',
    verdict: 'Would not buy',
    statedReasoning:
      'Nice pack, but $199 is a stretch for something we’d use a handful of times a year. Kids’ gear at this price is a hard sell.',
    priceSensitivity: 'Overpriced',
    objections: [
      'Price feels high for the capacity',
      'Kids will outgrow interest before the pack wears out',
    ],
  },
  {
    personaId: 'PER-003',
    productId: 'PUT-001',
    verdict: 'Would not buy',
    statedReasoning:
      'I care about grams more than anything else. Without a published weight spec I have to assume it’s heavier than my current setup.',
    priceSensitivity: 'Overpriced',
    objections: ['Heavier than my current 45L pack', 'No weight specification listed'],
  },
  {
    personaId: 'PER-004',
    productId: 'PUT-001',
    verdict: 'Would buy',
    statedReasoning:
      'This is exactly the size and durability I want for car-camping trips with overflow gear. Price feels reasonable for how often we’d use it.',
    priceSensitivity: 'Fair',
    objections: ['Wish it came in more color options'],
  },
  {
    personaId: 'PER-005',
    productId: 'PUT-001',
    verdict: 'Would buy',
    statedReasoning:
      'The build quality and materials look premium in the photos. I’d buy this to add to my rotation if the stitching holds up.',
    priceSensitivity: 'Fair',
    objections: ['Wants more technical specs published (denier, frame material)'],
  },
  {
    personaId: 'PER-006',
    productId: 'PUT-001',
    verdict: 'Would consider',
    statedReasoning:
      'I’d need to know more about where the materials come from and whether it can be repaired before I’d commit to buying it.',
    priceSensitivity: 'Fair',
    objections: ['No information about recycled materials or a repair program'],
  },
  {
    personaId: 'PER-007',
    productId: 'PUT-001',
    verdict: 'Would not buy',
    statedReasoning:
      'This is bigger than what I need for commuting. I’m mostly carrying a laptop and a change of clothes, not multi-day gear.',
    priceSensitivity: 'Overpriced',
    objections: [
      'Too large for daily commute use',
      'Unclear if it fits carry-on requirements for occasional flights',
    ],
  },
  {
    personaId: 'PER-008',
    productId: 'PUT-001',
    verdict: 'Would consider',
    statedReasoning:
      'It looks like a thoughtful gift, but I don’t know backpacks well enough to judge fit or sizing for the person I’d be buying it for.',
    priceSensitivity: 'Fair',
    objections: ['Hard to judge fit and sizing as a gift buyer'],
  },
];

export const demandSignalRun: DemandSignalRun = {
  id: 'DSR-001',
  productId: 'PUT-001',
  date: 'Sep 26, 2026 at 2:15 PM',
  personaCount: 8,
  interestScore: 44,
  wouldBuyPct: 25,
  wouldConsiderPct: 38,
  wouldNotBuyPct: 37,
  topObjections: [
    { objection: 'Price feels high for the capacity', count: 4 },
    { objection: 'Unclear if it fits carry-on requirements', count: 3 },
    { objection: 'No information on materials or sustainability', count: 2 },
    { objection: 'Heavier than expected for the capacity', count: 2 },
  ],
  validationNote:
    'Interest is strongest among car campers and gear hobbyists; budget-conscious and ultralight segments cite price and weight as the primary barriers.',
};
