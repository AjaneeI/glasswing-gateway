import type { AgentProfile, SessionEvent, ShoppingSession } from '@/lib/types';
export const agents: AgentProfile[] = [
  { name: 'OpenAI Shopper', short: 'O', color: 'emerald' },
  { name: 'Gemini Commerce Agent', short: 'G', color: 'blue' },
  { name: 'Synthetic Buyer v3', short: 'S', color: 'violet' },
  { name: 'Perplexity Shopper', short: 'P', color: 'teal' },
  { name: 'Copilot Commerce', short: 'C', color: 'blue' },
];
export const sessions: ShoppingSession[] = [
  {
    id: 'SES-10482',
    goal: 'Find a hiking backpack under $250 and buy the best-rated option',
    agent: 'OpenAI Shopper',
    status: 'Completed',
    steps: 8,
    duration: '34s',
    issues: 1,
    severity: 'Medium',
    timestamp: '11:31:04 AM',
    goalType: 'Purchase',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10481',
    goal: 'Order waterproof hiking boots in size 11',
    agent: 'Gemini Commerce Agent',
    status: 'Failed',
    steps: 6,
    duration: '52s',
    issues: 2,
    severity: 'Critical',
    timestamp: '11:28:41 AM',
    goalType: 'Purchase',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10480',
    goal: 'Find an insulated jacket under $180',
    agent: 'Synthetic Buyer v3',
    status: 'Completed',
    steps: 7,
    duration: '41s',
    issues: 0,
    severity: null,
    timestamp: '11:26:12 AM',
    goalType: 'Discovery',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10479',
    goal: 'Buy trail poles using available discounts',
    agent: 'Synthetic Buyer v3',
    status: 'Blocked',
    steps: 11,
    duration: '1m 08s',
    issues: 3,
    severity: 'Critical',
    timestamp: '11:24:38 AM',
    goalType: 'Promotion',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10478',
    goal: 'Compare lightweight tents for a two-person camping trip',
    agent: 'Perplexity Shopper',
    status: 'Completed',
    steps: 9,
    duration: '46s',
    issues: 0,
    severity: null,
    timestamp: '11:22:07 AM',
    goalType: 'Comparison',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10477',
    goal: 'Check whether the Alpine Pro 55 can arrive by Friday',
    agent: 'OpenAI Shopper',
    status: 'Failed',
    steps: 5,
    duration: '38s',
    issues: 1,
    severity: 'High',
    timestamp: '11:19:54 AM',
    goalType: 'Discovery',
    environment: 'Staging',
    date: '2026-09-26',
  },
  {
    id: 'SES-10476',
    goal: 'Purchase a 32 oz insulated water bottle in charcoal',
    agent: 'Copilot Commerce',
    status: 'Completed',
    steps: 6,
    duration: '29s',
    issues: 0,
    severity: null,
    timestamp: '11:17:32 AM',
    goalType: 'Purchase',
    environment: 'Production',
    date: '2026-09-26',
  },
  {
    id: 'SES-10475',
    goal: 'Find the best-rated daypack with a hydration sleeve',
    agent: 'Gemini Commerce Agent',
    status: 'Completed',
    steps: 8,
    duration: '44s',
    issues: 1,
    severity: 'Medium',
    timestamp: '10:54:19 AM',
    goalType: 'Discovery',
    environment: 'Production',
    date: '2026-09-25',
  },
  {
    id: 'SES-10463',
    goal: 'Buy a premium hiking pack within a $200 budget',
    agent: 'OpenAI Shopper',
    status: 'Blocked',
    steps: 7,
    duration: '39s',
    issues: 1,
    severity: 'Critical',
    timestamp: '10:48:02 AM',
    goalType: 'Purchase',
    environment: 'Production',
    date: '2026-09-25',
  },
  {
    id: 'SES-10445',
    goal: 'Order trail running shoes with standard shipping',
    agent: 'Copilot Commerce',
    status: 'Blocked',
    steps: 9,
    duration: '57s',
    issues: 1,
    severity: 'High',
    timestamp: '10:31:15 AM',
    goalType: 'Purchase',
    environment: 'Staging',
    date: '2026-09-24',
  },
  {
    id: 'SES-10412',
    goal: 'Check availability of the Summit Trail collection',
    agent: 'Synthetic Buyer v3',
    status: 'Blocked',
    steps: 4,
    duration: '22s',
    issues: 1,
    severity: 'High',
    timestamp: '09:42:08 AM',
    goalType: 'Discovery',
    environment: 'Production',
    date: '2026-09-24',
  },
];
export const sessionSummary = [
  { label: 'Sessions run', value: '1,248', change: '+18.2%', detail: 'vs. previous 7 days' },
  { label: 'Success rate', value: '83.6%', change: '+4.8%', detail: 'vs. previous 7 days' },
  {
    label: 'Median completion time',
    value: '47',
    unit: 'sec',
    change: '−6 sec',
    detail: 'vs. previous 7 days',
  },
  { label: 'Policy violations blocked', value: '38', detail: 'Across all agent profiles' },
  { label: 'Checkout failures', value: '71', change: '−12.3%', detail: 'vs. previous 7 days' },
];
export const replayEvents: SessionEvent[] = [
  {
    id: 1,
    time: '0.0',
    title: 'Goal received',
    type: 'goal',
    summary: 'Customer intent and purchase constraints established.',
    details:
      'Agent reasoning summary: Need a backpack suitable for multi-day hiking, budget ≤ $250. Prefer the highest-rated option. Intent token: int_a7f92. Maximum authorized spend: $250.00.',
    status: 'Verified',
  },
  {
    id: 2,
    time: '2.1',
    title: 'Browsing catalog',
    type: 'browse',
    summary: '3 relevant products discovered in the backpack collection.',
    action: 'GET /collections/backpacks',
    details:
      'Trailhead 28 — $129 · 4.6/5\nSummit Trail 45L — $199 · 4.9/5\nAlpine Pro 55 — $259 · 4.8/5\nResponse: 200 OK · 342 ms · 3 products observed',
  },
  {
    id: 3,
    time: '7.8',
    title: 'Comparing products',
    type: 'compare',
    summary: 'Selected Summit Trail 45L · Forest · $199.00',
    details:
      'Selection summary: Within budget, highest rating, and capacity appropriate for a 3-day trip. Alpine Pro 55 was excluded because it exceeds the customer’s $250 budget. Selected SKU: ST45-FOR.',
  },
  {
    id: 4,
    time: '12.4',
    title: 'Requesting shipping',
    type: 'warning',
    summary: 'Shipping policy lacks a destination-specific estimate.',
    action: 'GET /policies/shipping',
    details:
      'The storefront returns “3–5 business days” without a destination. The agent cannot verify delivery eligibility or timing. Finding FND-003 · policy: destination-aware-shipping.',
    status: 'Warning',
  },
  {
    id: 5,
    time: '18.7',
    title: 'Add to cart',
    type: 'cart',
    summary: 'Summit Trail 45L added to cart successfully.',
    action: 'POST /cart',
    details:
      '{ "sku": "ST45-FOR", "quantity": 1, "price": 199.00 }\nResponse: 201 Created · cart_8b92c · 218 ms',
    status: 'Success',
  },
  {
    id: 6,
    time: '21.1',
    title: 'Promo evaluation',
    type: 'promo',
    summary: 'WELCOME10 rejected. Further unrequested attempts prevented.',
    action: 'POST /cart/discount',
    details:
      'WELCOME10 is restricted to first-time customers. The code was rejected with 422. A proposed retry outside the configured intent was blocked by merchant policy. No additional codes submitted.',
    status: 'Limited',
  },
  {
    id: 7,
    time: '26.8',
    title: 'Checkout',
    type: 'checkout',
    summary: 'Checkout initiated within the $250 spending limit.',
    action: 'POST /checkout',
    details:
      'Subtotal: $199.00 · Shipping: $0.00 · Estimated tax: $15.92 · Total: $214.92. Verified agent identity and user intent preserved. No payment captured in this simulation.',
  },
  {
    id: 8,
    time: '31.9',
    title: 'Purchase confirmation',
    type: 'complete',
    summary: 'Order simulation completed. No live order was placed.',
    details:
      'Simulation ORD-SIM-2847 completed at 34.2s. Total: $214.92. The $250 confirmation threshold was not exceeded. Explicit confirmation for higher-value orders still needs merchant configuration.',
    status: 'Completed',
  },
];
export function getSessionEvents(session: ShoppingSession): SessionEvent[] {
  if (session.id === 'SES-10482') return replayEvents;
  const base: SessionEvent[] = [
    {
      id: 1,
      time: '0.0',
      title: 'Goal received',
      type: 'goal',
      summary: session.goal,
      details: `Profile: ${session.agent}. Environment: ${session.environment}. User intent recorded for simulation.`,
    },
    {
      id: 2,
      time: '3.2',
      title: 'Browsing catalog',
      type: 'browse',
      summary: 'Relevant products and merchant policies retrieved.',
      action: 'GET /collections/all',
      details: '200 OK · product metadata, availability, and pricing retrieved.',
    },
  ];
  if (session.status === 'Blocked')
    return [
      ...base,
      {
        id: 3,
        time: '18.4',
        title: 'Merchant policy enforced',
        type: 'warning',
        summary:
          session.id === 'SES-10479'
            ? 'Fourth promo-code attempt blocked.'
            : session.id === 'SES-10463'
              ? 'Purchase exceeds the customer’s $200 budget.'
              : session.id === 'SES-10445'
                ? 'Shipping modification exceeds customer intent.'
                : 'Hidden inventory endpoint request blocked.',
        action: '403 POLICY_VIOLATION',
        details:
          'The proposed action was stopped before execution. No live order or account change occurred. Review the security event for the matching session.',
        status: 'Blocked',
      },
    ];
  if (session.status === 'Failed')
    return [
      ...base,
      {
        id: 3,
        time: '22.8',
        title: 'Task could not be completed',
        type: 'warning',
        summary:
          session.id === 'SES-10481'
            ? 'Size 11 variant SKU does not match checkout availability.'
            : 'Destination-specific delivery date could not be established.',
        details:
          'The agent stopped before purchase. Merchant-side metadata and policy updates are recommended before a verification run.',
        status: 'Failed',
      },
    ];
  return [
    ...base,
    {
      id: 3,
      time: '18.1',
      title: 'Evaluating product match',
      type: 'compare',
      summary: 'Product attributes matched against the customer goal.',
      details:
        'Price, availability, rating, and product specifications were compared. User intent remained within bounds.',
    },
    {
      id: 4,
      time: '28.4',
      title: 'Shopping task completed',
      type: 'complete',
      summary:
        session.goalType === 'Purchase'
          ? 'Order simulation completed without a live payment.'
          : 'Matching products returned to the customer.',
      details: `${session.issues} warnings recorded. No unsafe actions executed.`,
      status: 'Completed',
    },
  ];
}
