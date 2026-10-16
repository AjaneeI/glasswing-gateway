import { createScanRoute } from '@/lib/api/scan-route';
import { mockSecurityPoliciesResult } from '@/lib/security-policies';

// The security-monitoring agent posts its report here; body must match the
// `SecurityPoliciesScanResult` shape in lib/types/index.ts. Shared by
// /security and the replay-detail sidebar (same policy list).
export const { GET, POST } = createScanRoute(mockSecurityPoliciesResult, [], 'policies');
