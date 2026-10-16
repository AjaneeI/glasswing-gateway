import { createScanRoute } from '@/lib/api/scan-route';
import { mockAnalyticsResult } from '@/lib/analytics-report';

// The analytics agent posts its report here — all three range windows in one
// payload; body must match the `AnalyticsScanResult` shape in
// lib/types/index.ts.
export const { GET, POST } = createScanRoute(mockAnalyticsResult, [], 'agentDistribution');
