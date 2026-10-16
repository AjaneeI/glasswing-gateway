'use client';
import { AgentDistributionChart, ChartCard, OperationalChart } from '@/components/charts/charts';
import { PageHeading } from '@/components/ui/page-heading';
import { Card, CardHeader } from '@/components/ui/primitives';
import { getAnalyticsReport, mockAnalyticsResult } from '@/lib/analytics-report';
import { analyticsRanges, type ChartRange } from '@/lib/mock-data/analytics';
import type { AnalyticsPoint, AnalyticsScanResult } from '@/lib/types';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
export default function AnalyticsPage() {
  const [range, setRange] = useState<ChartRange>('7d');
  const [report, setReport] = useState<AnalyticsScanResult>(mockAnalyticsResult);
  useEffect(() => {
    let cancelled = false;
    getAnalyticsReport().then((result) => {
      if (!cancelled) setReport(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const data: AnalyticsPoint[] = useMemo(() => report.ranges[range], [report, range]);
  const chartData = data as unknown as Record<string, string | number>[];
  const { agentDistribution, failureModes } = report;
  const maxFailureSessions = Math.max(1, ...failureModes.map((f) => f.sessions));
  return (
    <>
      <PageHeading
        title="Analytics"
        subtitle="Measure how reliably and safely agents shop your storefront."
        action={
          <div className="analytics-range">
            <CalendarDays size={14} />
            <span>Last</span>
            <div className="segmented-control">
              {analyticsRanges.map((r) => (
                <button
                  key={r}
                  className={range === r ? 'active' : ''}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="analytics-grid">
        <ChartCard
          title="Agent task success rate"
          subtitle="Shopping goals completed successfully"
          action={<span className="positive">↗ 4.8%</span>}
        >
          <div className="analytics-chart-value">
            {data[data.length - 1].success}
            <span>%</span>
            <small>
              across {range === '7d' ? '1,248' : range === '30d' ? '5,312' : '16,407'} sessions
            </small>
          </div>
          <OperationalChart data={chartData} dataKey="success" />
        </ChartCard>
        <ChartCard
          title="Checkout completion rate"
          subtitle="From checkout initiation to simulated order"
          action={<span className="positive">↗ 3.2%</span>}
        >
          <div className="analytics-chart-value">
            {data[data.length - 1].checkout}
            <span>%</span>
            <small>of checkout attempts</small>
          </div>
          <OperationalChart data={chartData} dataKey="checkout" color="#2ba98b" />
        </ChartCard>
        <ChartCard
          title="Product discovery success"
          subtitle="Agents that found a matching product"
        >
          <div className="analytics-chart-value">
            {data[data.length - 1].discovery}
            <span>%</span>
            <small>matching customer intent</small>
          </div>
          <OperationalChart data={chartData} dataKey="discovery" color="#7794cf" />
        </ChartCard>
        <ChartCard
          title="Policy violations blocked"
          subtitle="Unsafe actions stopped before execution"
        >
          <div className="analytics-chart-value">
            {data.reduce((sum, d) => sum + d.blocked, 0)}
            <small>blocked actions · 100% enforced</small>
          </div>
          <OperationalChart data={chartData} dataKey="blocked" color="#d8a055" bar percent={false} />
        </ChartCard>
        <ChartCard
          title="Readiness score over time"
          subtitle="A more reliable storefront with every scan"
        >
          <div className="analytics-chart-value">
            74<span>/ 100</span>
            <small className="positive">+13 points over this period</small>
          </div>
          <OperationalChart data={chartData} dataKey="score" color="#3976ed" percent={false} />
        </ChartCard>
        <ChartCard
          title="Sessions by agent type"
          subtitle="Distribution across the latest 1,248 sessions"
        >
          <AgentDistributionChart data={agentDistribution} />
          <div className="analytics-agent-footer">
            5 profiles<span>Cross-agent coverage</span>
          </div>
        </ChartCard>
      </div>
      <Card>
        <CardHeader
          title="Most common failure modes"
          subtitle="Prioritize the issues affecting the most shopping sessions."
          action={<span className="subtle-badge">Last {range}</span>}
        />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Failure</th>
                <th>Sessions</th>
                <th>Rate</th>
                <th>Trend</th>
                <th>Relative frequency</th>
              </tr>
            </thead>
            <tbody>
              {failureModes.map((f) => (
                <tr key={f.name}>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td className="mono">{f.sessions}</td>
                  <td className="mono">{f.rate}</td>
                  <td>
                    <span
                      className={
                        f.trend === 'down'
                          ? 'positive inline-flex items-center gap-1'
                          : f.trend === 'up'
                            ? 'warning-text inline-flex items-center gap-1'
                            : 'muted inline-flex items-center gap-1'
                      }
                    >
                      {f.trend === 'down' ? (
                        <ArrowDownRight size={14} />
                      ) : f.trend === 'up' ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <Minus size={14} />
                      )}
                      {f.change}
                    </span>
                  </td>
                  <td>
                    <div className="failure-bar">
                      <span style={{ width: `${(f.sessions / maxFailureSessions) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Failure-mode counts reflect the latest 1,248-session snapshot.</span>
          <span>Compared with previous period</span>
        </div>
      </Card>
    </>
  );
}
