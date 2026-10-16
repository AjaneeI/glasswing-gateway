'use client';
import Link from 'next/link';
import { QuantitativeOverview } from './quantitative-overview';
import { PageHeading } from '@/components/ui/page-heading';
import { MetricCard } from '@/components/ui/metric-card';
import { Button, Card, CardHeader, EmptyState, StatusBadge } from '@/components/ui/primitives';
import { formatCost, formatTime, type FindingResult, type PageResult } from '@/lib/gateway/client';
import { useGateway } from './provider';
import { ErrorNotice, FindingsList, FixtureBadge, useGatewayData } from './shared';
export function GatewayDashboard() {
  const { dashboard, loading, error, refresh, activeScan } = useGateway();
  const findings = useGatewayData<PageResult<FindingResult>>('/findings?limit=5', dashboard);
  return (
    <>
      <PageHeading
        title="Storefront testing overview"
        subtitle="Results from reviewed shopping scenarios and independent evaluations."
        action={
          <Button asChild>
            <Link href="/discover">New storefront scan</Link>
          </Button>
        }
      />
      <ErrorNotice message={error} retry={() => void refresh()} />
      {loading && !dashboard && <p role="status">Loading scan history…</p>}
      {dashboard && (
        <>
          <QuantitativeOverview data={dashboard.readiness} />
          <div className="metrics-grid four">
            <MetricCard
              label="Scans"
              value={String(dashboard.totalScans)}
              detail="Persisted test runs"
            />
            <MetricCard
              label="Shopping sessions"
              value={String(dashboard.totalSessions)}
              detail={`${dashboard.fixtureSessions} explicitly labeled fixtures`}
            />
            <MetricCard
              label="Inconclusive outcomes"
              value={String(dashboard.readiness.inconclusive)}
              detail="Latest scan · awaiting sufficient evidence"
            />
            <MetricCard
              label="Estimated model cost"
              value={
                dashboard.usage.estimatedCostUsd === null
                  ? '—'
                  : formatCost(dashboard.usage.estimatedCostUsd)
              }
              detail={`${dashboard.usage.inputTokens + dashboard.usage.outputTokens} recorded tokens`}
            />
          </div>
          {activeScan && ['running', 'queued'].includes(activeScan.status) && (
            <Card className="gateway-panel">
              <StatusBadge tone="blue">Scan in progress</StatusBadge>
              <p>{activeScan.draft.merchantUrl}</p>
              <Link className="text-link" href={`/scan?scanId=${activeScan.id}`}>
                Observe running sessions →
              </Link>
            </Card>
          )}
          <Card>
            <CardHeader
              title="Scan history"
              subtitle="Open a scan to inspect its sessions and findings."
              action={
                <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                  Refresh
                </Button>
              }
            />
            {dashboard.scans.length ? (
              <div className="gateway-table-wrap">
                <table className="gateway-table">
                  <thead>
                    <tr>
                      <th>Storefront</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Sessions</th>
                      <th>Outcomes</th>
                      <th>Results</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.scans.map((scan) => (
                      <tr key={scan.id}>
                        <td>
                          {scan.merchantUrl}
                          <small>{scan.environmentId}</small>
                          <FixtureBadge fixture={scan.fixture} />
                        </td>
                        <td>{formatTime(scan.createdAt)}</td>
                        <td>{scan.status}</td>
                        <td>{scan.sessionCount}</td>
                        <td>
                          {scan.passed} passed · {scan.failed} failed · {scan.inconclusive}{' '}
                          inconclusive
                        </td>
                        <td>
                          <Link className="text-link" href={`/scan?scanId=${scan.id}`}>
                            View scan
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No scans yet"
                description="Inspect a configured storefront and approve its test plan to begin."
                action={
                  <Button asChild>
                    <Link href="/discover">Inspect a storefront</Link>
                  </Button>
                }
              />
            )}
          </Card>
          <ErrorNotice message={findings.error} retry={findings.reload} />
          {findings.data && <FindingsList findings={findings.data.items} />}
          <p className="gateway-note">
            The pass rate measures reviewed shopping goals. Checkout and payment completion are
            outside this read-only test scope. Fixture sessions do not contribute to the pass rate.
          </p>
        </>
      )}
    </>
  );
}
