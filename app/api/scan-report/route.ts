import { createScanRoute } from '@/lib/api/scan-route';
import { mockScanReportResult } from '@/lib/scan-report';

// The scanning agent posts its full scan report here; body must match the
// `ScanReportScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(mockScanReportResult, [], 'issues');
