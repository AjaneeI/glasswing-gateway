import { createScanRoute } from '@/lib/api/scan-route';
import { mockNextStepsResult } from '@/lib/next-steps';

// The agent posts its benchmarked recommended-next-steps report here; body
// must match the `NextStepsScanResult` shape in lib/types/index.ts.
export const { GET, POST } = createScanRoute(mockNextStepsResult, [], 'recommendations');
