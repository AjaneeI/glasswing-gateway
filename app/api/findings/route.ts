import { createScanRoute } from '@/lib/api/scan-route';
import { mockFindingsResult } from '@/lib/findings';

// The agent posts its ranked top-findings report here; body must match the
// `FindingsScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(mockFindingsResult, [], 'findings');
