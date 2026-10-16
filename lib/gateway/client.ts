import type { Draft, Finding, ModelCall, Scan, Session } from './schemas';

export interface PageResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
export interface EnvironmentOption {
  id: string;
  origin: string;
  entryUrl?: string;
  searchPath: string;
  authorizedStoppingPoint: 'recommend_or_decline';
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
}
export interface ScanSummary {
  id: string;
  status: Scan['status'];
  fixture: boolean;
  merchantUrl: string;
  environmentId: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  sessionCount: number;
  passed: number;
  failed: number;
  inconclusive: number;
  findingCount: number;
  usage: Usage;
}
export interface DashboardData {
  readiness: import('./readiness').ReadinessOverview;
  scans: ScanSummary[];
  totalScans: number;
  totalSessions: number;
  fixtureSessions: number;
  evaluatedSessions: number;
  passedSessions: number;
  passRate: number | null;
  findings: number;
  usage: Usage;
}
export type SessionSummary = Omit<Session, 'trace' | 'modelCalls'> & {
  steps: number;
  usage: Usage;
};
export type FindingResult = Finding & { scanId: string; fixture: boolean };
export type CallResult = ModelCall & { operationId: string; recordedAt: string };
export class GatewayApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function gatewayRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api/gateway${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    ...(options.body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) }
      : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    const detail = Array.isArray(error?.issues)
      ? error.issues
          .map(
            (issue: { path: string[]; message: string }) =>
              `${issue.path.join('.')}: ${issue.message}`,
          )
          .join('; ')
      : '';
    throw new GatewayApiError(
      error?.code || 'REQUEST_FAILED',
      `${error?.message || 'Unable to load Gateway data.'}${detail ? ` ${detail}` : ''}`,
      response.status,
    );
  }
  if (payload?.apiVersion !== 'v1' || !('data' in payload))
    throw new GatewayApiError('INVALID_RESPONSE', 'Gateway returned an unexpected response.', 502);
  return payload.data as T;
}
export const gatewayClient = {
  environments: (signal?: AbortSignal) =>
    gatewayRequest<{ items: EnvironmentOption[] }>('/environments', { signal }),
  drafts: (signal?: AbortSignal) =>
    gatewayRequest<
      PageResult<
        Pick<Draft, 'id' | 'merchantUrl' | 'createdAt' | 'revision' | 'approvedAt' | 'fixture'>
      >
    >('/drafts?limit=25', { signal }),
  draft: (id: string) => gatewayRequest<Draft>(`/drafts/${encodeURIComponent(id)}`),
  scan: (id: string, signal?: AbortSignal) =>
    gatewayRequest<Scan>(`/scans/${encodeURIComponent(id)}`, { signal }),
  dashboard: (signal?: AbortSignal) => gatewayRequest<DashboardData>('/dashboard', { signal }),
};
export function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not started';
}
export function formatCost(value: number | null) {
  return value === null ? 'Not configured / unavailable' : `$${value.toFixed(4)}`;
}
export const terminalScan = (scan: Scan) => !['running', 'queued'].includes(scan.status);
