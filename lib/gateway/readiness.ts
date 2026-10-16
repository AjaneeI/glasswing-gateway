import { z } from 'zod';
import type { Scan } from './schemas';

export const categoryIds = ['discovery', 'checkout', 'security', 'compatibility'] as const;
export const categoryReportSchema = z
  .strictObject({
    category: z.enum(categoryIds),
    producer: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    unit: z.string().min(1).max(80),
    checks: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          result: z.enum(['pass', 'fail', 'unknown']),
          evidenceIds: z.array(z.string().uuid()).min(1).max(100),
        }),
      )
      .min(1)
      .max(200),
  })
  .refine(
    (report) => new Set(report.checks.map((check) => check.id)).size === report.checks.length,
    'Check IDs must be unique.',
  );
export type CategoryReport = z.infer<typeof categoryReportSchema> & { recordedAt: string };
export interface CategoryMetric {
  id: (typeof categoryIds)[number];
  name: string;
  description: string;
  unit: string;
  source: string;
  score: number | null;
  passed: number;
  failed: number;
  unknown: number;
  total: number;
  evidenceIds: string[];
}
const definitions = {
  discovery: {
    name: 'Discovery',
    description: 'Successful sampled navigation, search and product inspection actions.',
    unit: 'browser actions',
  },
  checkout: {
    name: 'Checkout',
    description: 'Checkout is unmeasured. Awaiting evaluator input.',
    unit: 'checkout checks',
  },
  security: {
    name: 'Security',
    description:
      'Shopper compliance with the reviewed action boundary; this is not a storefront security audit.',
    unit: 'proposed actions',
  },
  compatibility: {
    name: 'Compatibility',
    description:
      'Inspected observations containing exactly one product with a structured price and currency.',
    unit: 'product observations',
  },
};
function metric(
  id: CategoryMetric['id'],
  checks: { result: 'pass' | 'fail' | 'unknown'; evidenceIds: string[] }[],
  source = 'Shopper trace',
): CategoryMetric {
  const passed = checks.filter((c) => c.result === 'pass').length;
  const failed = checks.filter((c) => c.result === 'fail').length;
  return {
    id,
    ...definitions[id],
    source,
    passed,
    failed,
    unknown: checks.length - passed - failed,
    total: checks.length,
    score: passed + failed ? Math.round((100 * passed) / (passed + failed)) : null,
    evidenceIds: [...new Set(checks.flatMap((c) => c.evidenceIds))],
  };
}
export function readinessForScan(scan: Scan | null) {
  const events = scan?.sessions.flatMap((s) => s.trace) || [];
  const observations = [
    ...(scan?.draft.evidence || []),
    ...events.flatMap((e) => (e.observation ? [e.observation] : [])),
  ];
  const inspected = events.flatMap((e) =>
    e.observation?.kind === 'product' ? [e.observation] : [],
  );
  const categories = categoryIds.map((id) => {
    const report = scan?.categoryReports?.find((r) => r.category === id);
    if (report)
      return {
        ...metric(id, report.checks, report.producer),
        description: report.description,
        unit: report.unit,
      };
    if (id === 'discovery')
      return metric(
        id,
        events
          .filter((e) => e.action && e.action.type !== 'stop' && e.status !== 'blocked')
          .map((e) => ({ result: e.observation ? 'pass' : 'fail', evidenceIds: [e.id] })),
      );
    if (id === 'security')
      return metric(
        id,
        events
          .filter((e) => e.action)
          .map((e) => ({
            result: e.status === 'blocked' ? 'fail' : e.status === 'executed' ? 'pass' : 'unknown',
            evidenceIds: [e.id],
          })),
      );
    if (id === 'compatibility')
      return metric(
        id,
        inspected.map((o) => ({
          result:
            o.products.length === 1 && o.products[0].price !== null && !!o.products[0].currency
              ? 'pass'
              : 'fail',
          evidenceIds: [o.id],
        })),
      );
    const checkoutActions = events.filter(
      (event) =>
        event.action &&
        ['add_to_cart', 'view_cart', 'begin_checkout', 'fill_checkout'].includes(event.action.type),
    );
    const scope =
      scan?.draft.checkoutEnabled === true
        ? 'Enabled in the reviewed environment'
        : scan?.draft.checkoutEnabled === false
          ? 'Disabled in the reviewed environment'
          : 'Environment capability not recorded in this historical scan';
    return {
      ...metric(id, [], 'Awaiting evaluator'),
      description: `${scope}; ${checkoutActions.filter((e) => e.status === 'executed').length} checkout actions executed. Checkout quality and payment safety are unmeasured.`,
    };
  });
  const sessions = scan?.sessions || [];
  const passed = sessions.filter((s) => s.evaluation?.outcome === 'passed').length;
  const failed = sessions.filter((s) => s.evaluation?.outcome === 'failed').length;
  const inconclusive = sessions.filter((s) => s.evaluation?.outcome === 'inconclusive').length;
  return {
    scanId: scan?.id || null,
    merchantUrl: scan?.draft.merchantUrl || null,
    environmentId: scan?.draft.environmentId || null,
    fixture: scan?.fixture || false,
    status: scan?.status || null,
    measuredAt: scan?.completedAt || null,
    score: passed + failed ? Math.round((100 * passed) / (passed + failed)) : null,
    passed,
    failed,
    inconclusive,
    unevaluated: sessions.length - passed - failed - inconclusive,
    sessionCount: sessions.length,
    pagesObserved: new Set(observations.map((o) => o.url)).size,
    productsObserved: new Set(
      observations.flatMap((o) => o.products.map((p) => `${p.name}|${p.price}|${p.currency}`)),
    ).size,
    archetypes: scan?.draft.archetypes.length || 0,
    categories,
  };
}
export function readinessOverview(scans: Scan[]) {
  const sorted = [...scans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted.find((s) => !s.fixture) || sorted[0] || null;
  const history = latest
    ? sorted
        .filter(
          (s) =>
            s.fixture === latest.fixture &&
            s.draft.environmentId === latest.draft.environmentId &&
            new URL(s.draft.merchantUrl).origin === new URL(latest.draft.merchantUrl).origin &&
            s.status === 'completed',
        )
        .slice(0, 5)
        .reverse()
    : [];
  return {
    ...readinessForScan(latest),
    trend: history.map((scan) => ({
      scanId: scan.id,
      date: scan.completedAt || scan.createdAt,
      score: readinessForScan(scan).score,
    })),
  };
}
export type ReadinessOverview = ReturnType<typeof readinessOverview>;
