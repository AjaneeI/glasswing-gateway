'use client';
import { ErrorNotice, useGatewayData } from '@/components/gateway/shared';
import { PageHeading } from '@/components/ui/page-heading';
import { Card, CardHeader, LoadingLabel, StatusBadge } from '@/components/ui/primitives';
import { formatCost, type DashboardData } from '@/lib/gateway/client';
import { baselineIsSet, formatDuration, manualEquivalent, manualQaBaseline } from '@/lib/gateway/roi';
import Link from 'next/link';

export default function RoiPage() {
  const { data, error, loading, reload } = useGatewayData<DashboardData>('/dashboard');

  const sessions = data?.totalSessions ?? 0;
  const realSessions = sessions - (data?.fixtureSessions ?? 0);
  // An empty workspace aggregates to 0, not to a measured zero — `[].every()`
  // is vacuously true, so usage() reports a cost of 0 before anything has run.
  const hasRuns = (data?.totalScans ?? 0) > 0;
  const cost = hasRuns ? (data?.usage.estimatedCostUsd ?? null) : null;
  const costPerSession = cost !== null && sessions > 0 ? cost / sessions : null;
  const baseline = manualEquivalent(sessions);

  return (
    <>
      <PageHeading
        title="Return on investment"
        subtitle="What this costs to run, what it replaces, and which numbers are measured rather than assumed."
      />

      <div className="roi-banner">
        <p>
          We measure the cost. You supply the revenue. Every figure below that carries a dollar sign
          was recorded from a real run — we do not estimate what we cannot observe.
        </p>
      </div>

      {loading && (
        <div className="gateway-loading" role="status">
          <LoadingLabel>Loading your run history…</LoadingLabel>
        </div>
      )}
      <ErrorNotice message={error} retry={reload} />

      {data && (
        <>
          <Card className="roi-card">
            <CardHeader
              title="Measured from your runs"
              subtitle="Recorded per model call and aggregated across every scan in this workspace."
              action={
                <StatusBadge tone={!hasRuns ? 'neutral' : cost === null ? 'neutral' : 'green'}>
                  {!hasRuns
                    ? 'No runs yet'
                    : cost === null
                      ? 'Rates not configured'
                      : 'Measured'}
                </StatusBadge>
              }
            />
            <div className="roi-stats">
              <div>
                <span>Scans run</span>
                <strong>{data.totalScans}</strong>
              </div>
              <div>
                <span>Shopper sessions</span>
                <strong>
                  {sessions}
                  {realSessions !== sessions && <small> · {realSessions} live</small>}
                </strong>
              </div>
              <div>
                <span>Tokens in / out</span>
                <strong>
                  {data.usage.inputTokens.toLocaleString()}
                  <small> / {data.usage.outputTokens.toLocaleString()}</small>
                </strong>
              </div>
              <div className="highlight">
                <span>Total spend</span>
                <strong>{formatCost(cost)}</strong>
              </div>
              <div className="highlight">
                <span>Cost per session</span>
                <strong>{formatCost(costPerSession)}</strong>
              </div>
              <div>
                <span>Issues surfaced</span>
                <strong>{data.findings}</strong>
              </div>
            </div>
            <p className="roi-note">
              Cost is denominated per shopping session, not per seat. A session is one shopper
              attempting one goal end to end.
            </p>
          </Card>

          <Card className="roi-card">
            <CardHeader
              title="What this replaces"
              subtitle="The honest comparison is not against nothing — it is against someone doing this by hand."
            />
            {baselineIsSet() ? (
              <div className="roi-compare">
                <div>
                  <span>By hand</span>
                  <strong>
                    {formatDuration(baseline.minutes * 60_000)} · ${baseline.costUsd.toFixed(2)}
                  </strong>
                  <small>
                    {sessions} scenarios × {manualQaBaseline.minutesPerScenario} min at $
                    {manualQaBaseline.loadedHourlyRateUsd}/hr loaded
                  </small>
                </div>
                <div>
                  <span>With Gateway</span>
                  <strong>{formatCost(cost)}</strong>
                  <small>Runs on every deploy rather than once a quarter.</small>
                </div>
              </div>
            ) : (
              <div className="roi-empty">
                <p>
                  Set the manual-QA baseline in <code>lib/gateway/roi.ts</code> to show this
                  comparison. It stays hidden rather than displaying a number nobody timed.
                </p>
              </div>
            )}
            <p className="roi-note">
              The cost delta is the smaller half of the argument. The structural change is
              frequency: a manual pass happens when someone remembers, and this happens on every
              release.
            </p>
          </Card>

          <Card className="roi-card">
            <CardHeader
              title="The part we deliberately do not price"
              subtitle="Where the rate is ours to measure and the revenue is yours to apply."
            />
            <div className="roi-split">
              <div>
                <span className="roi-split-label">We measure</span>
                <ul>
                  <li>
                    The share of shopper goals that fail —{' '}
                    <strong>
                      {data.evaluatedSessions
                        ? `${data.passedSessions} of ${data.evaluatedSessions} conclusive goals passed`
                        : 'no conclusive evaluations yet'}
                    </strong>
                  </li>
                  <li>Which storefront patterns caused each failure</li>
                  <li>Whether a fix actually resolved it on the next run</li>
                </ul>
              </div>
              <div>
                <span className="roi-split-label">You apply</span>
                <ul>
                  <li>Your agent-referred traffic volume</li>
                  <li>Your average order value</li>
                  <li>Your own conversion baseline</li>
                </ul>
              </div>
            </div>
            <p className="roi-note">
              We do not publish a lost-revenue figure. A failure rate we observed multiplied by
              numbers you already own is defensible; a market-sized estimate is not.
            </p>
          </Card>

          <div className="roi-links">
            <Link className="text-link" href="/pitch">
              See the full business case →
            </Link>
            <Link className="text-link" href="/recommendations">
              See what to fix →
            </Link>
          </div>
        </>
      )}
    </>
  );
}
