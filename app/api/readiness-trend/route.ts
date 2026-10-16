import { createScanRoute } from '@/lib/api/scan-route';
import { mockReadinessTrendResult } from '@/lib/readiness-trend';

// The agent posts the merchant's last-5-scans readiness trend here; body
// must match the `ReadinessTrendScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(mockReadinessTrendResult, ['target'], 'points');
