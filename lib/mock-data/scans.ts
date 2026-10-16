import type { Finding, ReadinessMetric, Scan } from '@/lib/types';
export const latestScan: Scan = {
  id: 'SCN-0025',
  score: 74,
  date: 'Sep 26, 2026 at 11:42 AM',
  pages: 86,
  sessions: 48,
  duration: '2m 34s',
  phases: [
    { name: 'Discoverability', issues: 3 },
    { name: 'Product Semantics', issues: 2 },
    { name: 'Checkout Flow', issues: 0 },
    { name: 'Policies', issues: 4 },
    { name: 'Agent Signals', issues: 1 },
  ],
};
export const readinessMetrics: ReadinessMetric[] = [
  {
    name: 'Discovery',
    score: 82,
    description: 'Products and content are findable by shopping agents.',
    status: 'Good',
    icon: 'discovery',
    change: 5,
  },
  {
    name: 'Checkout',
    score: 68,
    description: 'Agents can complete purchases, with some friction.',
    status: 'Needs work',
    icon: 'checkout',
    change: 3,
  },
  {
    name: 'Security',
    score: 61,
    description: 'Intent controls and abuse protections need improvement.',
    status: 'Needs attention',
    icon: 'security',
    change: 2,
  },
  {
    name: 'Compatibility',
    score: 77,
    description: 'Structured data and policies are mostly machine-readable.',
    status: 'Good',
    icon: 'compatibility',
    change: 4,
  },
];
export const findings: Finding[] = [
  {
    id: 'FND-001',
    title: 'Variant metadata unclear',
    description: 'Backpack color and capacity variants are inconsistently represented.',
    severity: 'Critical',
    category: 'Product semantics',
    detail:
      'The capacity selector updates the visible product but leaves the structured SKU unchanged. Agents cannot reliably identify the 45L / Forest configuration. Add ProductGroup and hasVariant metadata for all configurations.',
    path: '/products/summit-trail-45l',
    affected: 143,
  },
  {
    id: 'FND-002',
    title: 'No verified agent identity policy',
    description: 'Authenticated shopping agents are indistinguishable from generic automation.',
    severity: 'High',
    category: 'Security',
    detail:
      'Requests to the cart and checkout endpoints accept unsigned agent requests. Enforce identity verification before write actions and preserve the verified identity through checkout.',
    path: '/api/checkout',
    affected: 82,
  },
  {
    id: 'FND-003',
    title: 'Shipping estimate lacks destination validation',
    description: 'Agents receive a delivery estimate before a destination is provided.',
    severity: 'Medium',
    category: 'Policies',
    detail:
      'The page advertises 3–5 day delivery for all destinations. Expose delivery constraints by country and postal code before agents commit to a delivery promise.',
    path: '/policies/shipping',
    affected: 98,
  },
  {
    id: 'FND-004',
    title: 'Confirmation missing for purchases above $250',
    description: 'The checkout flow can proceed without explicit customer confirmation.',
    severity: 'Medium',
    category: 'Security',
    detail:
      'Three test sessions reached order placement over the confirmation threshold. Require a signed confirmation token bound to the final order amount.',
    path: '/checkout/confirm',
    affected: 3,
  },
];
export const scanIssues = [
  {
    id: 1,
    title: 'Missing structured variant data',
    category: 'Product semantics',
    severity: 'Critical' as const,
    description: 'Color and capacity combinations do not map to unique SKUs in the product schema.',
  },
  {
    id: 2,
    title: 'Unclear shipping estimate',
    category: 'Policies',
    severity: 'Critical' as const,
    description: 'The shipping estimate is not validated against the destination.',
  },
  {
    id: 3,
    title: 'Ambiguous returns language',
    category: 'Policies',
    severity: 'High' as const,
    description:
      'Return eligibility is visible to people but absent from machine-readable metadata.',
  },
  {
    id: 4,
    title: 'No explicit agent checkout confirmation',
    category: 'Security',
    severity: 'Critical' as const,
    description:
      'The agent cannot determine whether the capacity selection changes the SKU or confirmation requirements.',
  },
];
export const scanFixes = [
  { title: 'Add schema.org ProductGroup / variant metadata', impact: 'High' },
  { title: 'Expose destination-aware shipping policy', impact: 'High' },
  { title: 'Define autonomous checkout confirmation policy', impact: 'High' },
  { title: 'Add machine-readable returns policy', impact: 'Medium' },
];
export const previewPages = ['Product page', 'Checkout', 'Cart', 'Shipping policy'];
