import { test, expect } from '@playwright/test';
import { readinessForScan, readinessOverview } from '../../lib/gateway/readiness';
import type { Scan } from '../../lib/gateway/schemas';

function scan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: 'scan',
    createdAt: '2026-01-01',
    status: 'completed',
    fixture: false,
    completedAt: '2026-01-01',
    draft: {
      merchantUrl: 'https://shop.test/',
      environmentId: 'test',
      evidence: [],
      archetypes: [],
    },
    sessions: [],
    findings: [],
    ...overrides,
  } as unknown as Scan;
}
test('unknown outcomes stay unknown and conclusive goal scores exclude them', () => {
  expect(readinessForScan(null).categories).toHaveLength(4);
  expect(readinessForScan(null).score).toBeNull();
  const session = (outcome: string) => ({ evaluation: { outcome }, trace: [] });
  const inconclusive = scan({
    sessions: [session('inconclusive'), session('inconclusive')] as unknown as Scan['sessions'],
  });
  expect(readinessForScan(inconclusive)).toMatchObject({ score: null, inconclusive: 2, failed: 0 });
  const mixed = scan({
    sessions: [
      session('passed'),
      session('failed'),
      session('inconclusive'),
    ] as unknown as Scan['sessions'],
  });
  expect(readinessForScan(mixed)).toMatchObject({ score: 50, inconclusive: 1 });
});
test('trend excludes other storefronts, environments and fixtures', () => {
  const real = scan({ id: 'real' });
  const fixture = scan({ id: 'fixture', createdAt: '2026-01-05', fixture: true });
  const other = scan({
    id: 'other',
    createdAt: '2025-12-01',
    draft: { ...real.draft, merchantUrl: 'https://other.test/' },
  });
  const environment = scan({
    id: 'other-env',
    createdAt: '2025-12-02',
    draft: { ...real.draft, environmentId: 'other' },
  });
  const result = readinessOverview([fixture, other, real, environment]);
  expect(result.scanId).toBe('real');
  expect(result.trend.map((point) => point.scanId)).toEqual(['real']);
});

test('checkout reporting distinguishes disabled, enabled and historical capability without inventing a score', () => {
  const record = scan();
  const checkout = () => readinessForScan(record).categories.find((c) => c.id === 'checkout')!;
  expect(checkout().description).toContain('not recorded');
  record.draft.checkoutEnabled = false;
  expect(checkout().description).toContain('Disabled');
  record.draft.checkoutEnabled = true;
  record.sessions = [
    { trace: [{ id: 'event', action: { type: 'view_cart' }, status: 'executed' }] },
  ] as unknown as Scan['sessions'];
  expect(checkout().description).toContain('Enabled');
  expect(checkout().description).toContain('1 checkout actions executed');
  expect(checkout().score).toBeNull();
  expect(checkout().description).toContain('payment safety are unmeasured');
});
