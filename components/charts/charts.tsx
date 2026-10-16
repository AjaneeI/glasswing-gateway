'use client';
import { Card, CardHeader } from '@/components/ui/primitives';
import { agentDistribution, readinessTrend } from '@/lib/mock-data/analytics';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
const axisStyle = { fontSize: 10, fill: '#98a1b1', fontFamily: 'inherit' };
const tooltipStyle = {
  border: '1px solid #e5e9f0',
  borderRadius: 7,
  fontSize: 12,
  boxShadow: '0 4px 20px #1821370d',
};
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </Card>
  );
}
export function ReadinessTrendChart({
  data = readinessTrend,
}: {
  data?: { name: string; score: number; target: number }[];
}) {
  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 12, right: 14, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3976ed" stopOpacity={0.13} />
              <stop offset="100%" stopColor="#3976ed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e9edf3" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisStyle} dy={8} />
          <YAxis
            domain={[40, 100]}
            ticks={[40, 60, 80, 100]}
            axisLine={false}
            tickLine={false}
            tick={axisStyle}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [value, name === 'score' ? 'Readiness' : 'Target']}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#3976ed"
            strokeWidth={2.3}
            fill="url(#readinessFill)"
            dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="target"
            stroke="#b9c4d6"
            strokeDasharray="4 4"
            dot={false}
            strokeWidth={1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function OperationalChart({
  data,
  dataKey,
  color = '#3976ed',
  percent = true,
  bar = false,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  color?: string;
  percent?: boolean;
  bar?: boolean;
}) {
  const Chart = bar ? BarChart : AreaChart;
  return (
    <div className="operational-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <Chart data={data} margin={{ left: -23, right: 12, top: 12, bottom: 2 }}>
          <defs>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.13} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="#e9edf3" />
          <XAxis
            dataKey="name"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            dy={8}
          />
          <YAxis
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            domain={percent ? [0, 100] : [0, 'auto']}
            tickFormatter={(v) => `${v}${percent ? '%' : ''}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [
              `${v}${percent ? '%' : ''}`,
              dataKey === 'blocked' ? 'Blocked actions' : 'Rate',
            ]}
          />
          {bar ? (
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ) : (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#fill-${dataKey})`}
              isAnimationActive={false}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
export function AgentDistributionChart({
  data = agentDistribution,
}: {
  data?: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((sum, a) => sum + a.value, 0);
  return (
    <div className="distribution-chart">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={170}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={72}
              paddingAngle={3}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((a) => (
                <Cell key={a.name} fill={a.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <strong>{total.toLocaleString()}</strong>
          <span>sessions</span>
        </div>
      </div>
      <div className="chart-legend-list">
        {data.map((a) => (
          <div key={a.name}>
            <span style={{ background: a.color }} />
            <span>{a.name}</span>
            <strong>{a.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
