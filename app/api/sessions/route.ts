import { createScanRoute } from '@/lib/api/scan-route';
import { mockSessionsResult } from '@/lib/sessions-report';

// The session-monitoring agent posts its report here; body must match the
// `SessionsScanResult` shape in lib/types/index.ts. Shared by /sessions and
// /replays (same underlying list).
export const { GET, POST } = createScanRoute(mockSessionsResult, [], 'sessions');
