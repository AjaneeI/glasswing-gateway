'use client';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ScoreRing } from '@/components/dashboard/score-ring';
import { ReadinessCard } from '@/components/dashboard/readiness-card';
import { Card, CardHeader } from '@/components/ui/primitives';
import type { ReadinessOverview } from '@/lib/gateway/readiness';
import { FixtureBadge } from './shared';

export function QuantitativeOverview({ data }: { data: ReadinessOverview }) {
  const measured = data.passed + data.failed;
  return (
    <div className="gateway-stack gateway-quantitative">
      <Card className="readiness-overview">
        <CardHeader
          title="Agent readiness overview"
          subtitle="Latest scan · goal success among conclusive evaluations"
          action={data.scanId ? <FixtureBadge fixture={data.fixture} /> : undefined}
        />
        <div className="readiness-overview-body">
          <ScoreRing score={data.score} label="Goal readiness" />
          <div className="readiness-summary">
            <h2>
              {!data.scanId
                ? 'Ready for your first scan'
                : !measured
                  ? 'More evidence needed'
                  : `${data.passed} of ${measured} conclusive goals passed`}
            </h2>
            <p>
              {data.inconclusive} inconclusive · {data.unevaluated} awaiting evaluation.
              Inconclusive outcomes are not failures and do not enter the score.
            </p>
            <div className="readiness-legend">
              <span>
                <i className="green" />
                {data.passed} passed
              </span>
              <span>
                <i className="amber" />
                {data.failed} failed
              </span>
              <span>
                <i className="blue" />
                {data.inconclusive} inconclusive
              </span>
            </div>
          </div>
          <div className="gateway-scope-summary">
            <strong>
              {data.merchantUrl ? new URL(data.merchantUrl).hostname : 'No storefront tested'}
            </strong>
            <p>{data.environmentId || 'Choose an environment on Discover'}</p>
            <div className="merchant-stats">
              <span>
                <strong>{data.pagesObserved}</strong> unique pages observed
              </span>
              <span>
                <strong>{data.productsObserved}</strong> distinct product records observed
              </span>
              <span>
                <strong>{data.archetypes}</strong> behavioral archetypes
              </span>
              <span>
                <strong>{data.sessionCount}</strong> shopping sessions
              </span>
            </div>
            <small>Sampled evidence, not a complete catalog census.</small>
          </div>
        </div>
        <div className="overview-card-footer">
          <span>
            {data.status ? `Scan ${data.status}` : 'No scan results yet'} · Recommendation or
            decline scope
          </span>
          <Link
            href={data.scanId ? `/scan?scanId=${data.scanId}` : '/discover'}
            className="text-link"
          >
            {data.scanId ? 'View supporting scan →' : 'Inspect a storefront →'}
          </Link>
        </div>
      </Card>
      <div className="section-label">
        <h2>Readiness by category</h2>
        <span>Observed checks and evaluator reports</span>
      </div>
      <div className="readiness-grid">
        {data.categories.map((category) => (
          <div className="gateway-category" key={category.id}>
            <ReadinessCard
              metric={{
                name: category.name,
                icon: category.id,
                score: category.score,
                change: null,
                status:
                  category.score === null
                    ? 'Not yet measured'
                    : category.unknown
                      ? 'Partial evidence'
                      : category.failed
                        ? 'Needs attention'
                        : 'Good',
                description: category.description,
                meta: {
                  passing: category.passed,
                  total: category.total,
                  unitLabel: category.unit,
                  breakdown: [
                    { name: 'Failed', passing: category.failed, total: category.total },
                    { name: 'Unknown', passing: category.unknown, total: category.total },
                  ],
                },
              }}
            />
            <div className="gateway-category-source">
              <small>Source: {category.source}</small>
              {data.scanId && category.total > 0 && (
                <Link href={`/scan?scanId=${data.scanId}`} className="text-link">
                  View evidence →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="gateway-note">
        Category percentages use passed ÷ (passed + failed) checks. Unknown checks are shown
        separately. Trace metrics describe sampled agent interactions; they do not assert whole-site
        coverage.
      </p>
      <Card>
        <CardHeader
          title="Agent readiness trend"
          subtitle="Last five completed scans for this storefront and environment · scenarios can differ between scans"
        />
        {data.trend.some((point) => point.score !== null) ? (
          <div className="gateway-readiness-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={data.trend.map((point, index) => ({ ...point, name: `Scan ${index + 1}` }))}
                margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`, 'Conclusive goal pass rate']} />
                <Line
                  dataKey="score"
                  type="linear"
                  stroke="#3976ed"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="gateway-panel">
            {data.trend.length
              ? 'These scans have no conclusive evaluations yet.'
              : 'Complete a scan to start the trend.'}
          </p>
        )}
        <div className="gateway-trend-links">
          {data.trend.map((point, index) => (
            <Link key={point.scanId} href={`/scan?scanId=${point.scanId}`} className="text-link">
              Scan {index + 1} ·{' '}
              {point.score === null ? 'Inconclusive / unmeasured' : `${point.score}%`}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
