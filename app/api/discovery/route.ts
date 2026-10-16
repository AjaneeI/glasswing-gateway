import { createScanRoute } from '@/lib/api/scan-route';
import { mockDiscoveryResult } from '@/lib/discovery';

// The discoverability-scanning agent posts its scan result here; body must
// match the `DiscoveryScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(
  mockDiscoveryResult,
  ['totalProducts', 'discoverableProducts'],
  'categories'
);
