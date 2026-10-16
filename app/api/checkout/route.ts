import { mockCheckoutResult } from '@/lib/checkout';
import { createScanRoute } from '@/lib/api/scan-route';

// The checkout-scanning agent posts its scan result here; body must match
// the `CheckoutScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(
  mockCheckoutResult,
  ['totalFlows', 'completableFlows'],
  'flows'
);
