import { createScanRoute } from '@/lib/api/scan-route';
import { mockSecurityResult } from '@/lib/security';

// The security-scanning agent posts its scan result here; body must match
// the `SecurityScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(
  mockSecurityResult,
  ['totalPolicies', 'enforcedPolicies'],
  'policies'
);
