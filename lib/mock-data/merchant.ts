import type { Merchant } from '@/lib/types';
export const productConfig = {
  name: 'Gateway',
  organization: 'Evertrail, Inc.',
  plan: 'Pro plan',
  user: 'Jordan Diaz',
  role: 'Commerce Platform',
};
export const merchant: Merchant = {
  id: 'evertrail',
  name: 'Evertrail Outdoors',
  domain: 'evertrailoutdoors.com',
  description: 'Outdoor equipment retailer',
  products: 72,
  brands: 6,
  categories: 3,
  flows: 3,
};
export const environments = ['Production', 'Staging'] as const;
