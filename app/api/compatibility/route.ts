import { createScanRoute } from '@/lib/api/scan-route';
import { mockCompatibilityResult } from '@/lib/compatibility';

// The compatibility-scanning agent posts its scan result here; body must
// match the `CompatibilityScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(
  mockCompatibilityResult,
  ['totalSignals', 'compatibleSignals'],
  'signals'
);
