import type { FailureMode } from '@/lib/types';
export const readinessTrend = [
  { name: 'Sep 02', score: 61, target: 80 },
  { name: 'Sep 08', score: 64, target: 80 },
  { name: 'Sep 14', score: 67, target: 80 },
  { name: 'Sep 20', score: 70, target: 80 },
  { name: 'Sep 26', score: 74, target: 80 },
];
export type ChartRange = '7d' | '30d' | '90d';
export const analyticsRanges: ChartRange[] = ['7d', '30d', '90d'];
export function getAnalyticsData(range: ChartRange) {
  const count = range === '7d' ? 7 : range === '30d' ? 10 : 13;
  return Array.from({ length: count }, (_, i) => {
    const progress = i / (count - 1);
    const day =
      range === '7d'
        ? 20 + i
        : range === '30d'
          ? 1 + Math.round(progress * 25)
          : 1 + Math.round(progress * 25);
    return {
      name:
        range === '90d'
          ? `${['Jul', 'Aug', 'Sep'][Math.min(2, Math.floor(i / 5))]} ${day}`
          : `Sep ${day}`,
      success: Math.round((70 + progress * 13.6 + Math.sin(i * 1.8) * 3) * 10) / 10,
      checkout: Math.round(63 + progress * 18 + Math.sin(i) * 3),
      discovery: Math.round(78 + progress * 11 + Math.sin(i * 2) * 2),
      blocked: Math.round(2 + progress * 4 + (i % 3)),
      score: Math.round(61 + progress * 13),
    };
  });
}
export const agentDistribution = [
  { name: 'OpenAI', value: 432, color: '#3976ed' },
  { name: 'Gemini', value: 318, color: '#7b9cf0' },
  { name: 'Perplexity', value: 206, color: '#2ba999' },
  { name: 'Copilot', value: 168, color: '#a58ad3' },
  { name: 'Synthetic baseline', value: 124, color: '#b6c2d7' },
];
export const failureModes: FailureMode[] = [
  { name: 'Variant ambiguity', sessions: 143, rate: '11.4%', trend: 'down', change: '2.1%' },
  { name: 'Shipping uncertainty', sessions: 98, rate: '7.8%', trend: 'up', change: '0.8%' },
  { name: 'Checkout state mismatch', sessions: 71, rate: '5.7%', trend: 'down', change: '1.4%' },
  { name: 'Promotion abuse', sessions: 38, rate: '3.0%', trend: 'flat', change: '0.0%' },
];
