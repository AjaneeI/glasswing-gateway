import type { Recommendation } from '@/lib/types';
export const recommendations: Recommendation[] = [
  {
    id: 'REC-001',
    title: 'Add structured product variant metadata',
    problem: 'Agents cannot reliably map color and capacity options to individual SKUs.',
    reason:
      'The product page visually associates variants, but does not expose the relationship consistently through structured metadata.',
    fix: 'Add ProductGroup and hasVariant schema markup for each backpack configuration.',
    impact: '+6 readiness points',
    effort: 'Low',
    affected: 143,
    category: 'Product semantics',
    code: JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        name: 'Summit Trail Backpack',
        productGroupID: 'ST',
        variesBy: ['https://schema.org/color', 'https://schema.org/size'],
        hasVariant: [
          {
            '@type': 'Product',
            name: 'Summit Trail 45L — Forest',
            sku: 'ST45-FOR',
            color: 'Forest',
            size: '45L',
            offers: {
              '@type': 'Offer',
              price: '199.00',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            },
          },
        ],
      },
      null,
      2,
    ),
  },
  {
    id: 'REC-002',
    title: 'Define an agent identity policy',
    problem: 'Unverified automation can reach cart and checkout endpoints.',
    reason:
      'Agent requests carry no verifiable identity and inherit the same permissions as anonymous browsing sessions.',
    fix: 'Verify signed agent identity for write operations, and bind the verified identity to each shopping session.',
    impact: '+4 readiness points',
    effort: 'Medium',
    affected: 82,
    category: 'Security',
    code: 'policy: verified-agent-identity\nscope: [cart.write, checkout.create]\nrequire:\n  signed_agent_identity: true\n  session_binding: true\non_failure: block',
  },
  {
    id: 'REC-003',
    title: 'Require explicit confirmation for purchases above $250',
    problem: 'High-value purchases can proceed without explicit customer approval.',
    reason:
      'No machine-readable confirmation threshold is exposed to the shopping agent during checkout.',
    fix: 'Require a signed, single-use customer confirmation token when the final purchase total exceeds $250.',
    impact: 'Security +8%',
    effort: 'Low',
    affected: 3,
    category: 'Security',
    code: 'policy: purchase-confirmation\nscope: checkout.place_order\ncondition:\n  order_total_usd: ">250"\nrequire:\n  customer_confirmation: true\n  single_use_token: true\n  bind_to_final_total: true\non_failure: block',
  },
  {
    id: 'REC-004',
    title: 'Add machine-readable shipping constraints',
    problem: 'Shipping estimates are displayed without destination validation.',
    reason:
      'Agents interpret a general shipping statement as a delivery commitment for all destinations.',
    fix: 'Expose destination-aware shipping details in OfferShippingDetails and require postal code validation before quoting delivery.',
    impact: '+5 readiness points',
    effort: 'Medium',
    affected: 98,
    category: 'Policies',
    code: JSON.stringify(
      {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
          addressRegion: ['CA', 'NY', 'WA'],
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          businessDays: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'REC-005',
    title: 'Expose a machine-readable returns policy',
    problem: 'Return eligibility is unclear to autonomous shoppers.',
    reason: 'Natural-language exclusions are not linked to individual product offers.',
    fix: 'Add MerchantReturnPolicy metadata with a 30-day window, eligible countries, and return fees.',
    impact: '+3 readiness points',
    effort: 'Low',
    affected: 54,
    category: 'Policies',
    code: JSON.stringify(
      {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      null,
      2,
    ),
  },
];
