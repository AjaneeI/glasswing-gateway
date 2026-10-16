import type { SecurityEvent, SecurityPolicy } from '@/lib/types';
export const securityMetrics = [
  { label: 'Policy coverage', value: '78%', change: '+12%', detail: 'Of supported agent actions' },
  { label: 'Blocked unsafe actions', value: '38', detail: 'Last 7 days · before execution' },
  {
    label: 'Agent identity verification',
    value: '64%',
    change: '+8%',
    detail: 'Sessions with verified identities',
  },
  { label: 'Intent violations', value: '7', detail: 'All violations safely blocked' },
];
export const securityPolicies: SecurityPolicy[] = [
  {
    id: 'POL-001',
    name: 'Require verified agent identity',
    scope: 'All sessions',
    enforcement: 'Block',
    violations: 12,
    enabled: true,
  },
  {
    id: 'POL-002',
    name: 'Maximum purchase amount',
    scope: 'Checkout',
    enforcement: '$500',
    violations: 4,
    enabled: true,
  },
  {
    id: 'POL-003',
    name: 'Promo attempt limit',
    scope: 'Cart',
    enforcement: '3 attempts',
    violations: 17,
    enabled: true,
  },
  {
    id: 'POL-004',
    name: 'Purchase confirmation',
    scope: 'Orders > $250',
    enforcement: 'Require confirmation',
    violations: 3,
    enabled: true,
    warning: true,
  },
  {
    id: 'POL-005',
    name: 'Shipping modification',
    scope: 'Checkout',
    enforcement: 'User intent only',
    violations: 2,
    enabled: true,
  },
];
export const securityEvents: SecurityEvent[] = [
  {
    id: 'EVT-382',
    title: 'Agent attempted fourth promo code',
    severity: 'Critical',
    sessionId: 'SES-10479',
    time: '11:24:58 AM',
    policy: 'Promo attempt limit',
  },
  {
    id: 'EVT-381',
    title: 'Agent attempted purchase above customer budget',
    severity: 'Critical',
    sessionId: 'SES-10463',
    time: '10:48:24 AM',
    policy: 'Maximum purchase amount',
  },
  {
    id: 'EVT-380',
    title: 'Agent modified shipping speed outside user intent',
    severity: 'High',
    sessionId: 'SES-10445',
    time: '10:31:47 AM',
    policy: 'Shipping modification',
  },
  {
    id: 'EVT-379',
    title: 'Agent requested hidden inventory endpoint',
    severity: 'High',
    sessionId: 'SES-10412',
    time: '09:42:19 AM',
    policy: 'Require verified agent identity',
  },
];
export const merchantActions = [
  { name: 'Read product catalog', status: 'Allowed', time: '2.1s' },
  { name: 'Compare products', status: 'Allowed', time: '7.8s' },
  { name: 'Request shipping options', status: 'Allowed', time: '12.4s' },
  { name: 'Add item to cart', status: 'Allowed', time: '18.7s' },
  { name: 'Apply promo code', status: 'Allowed', time: '21.1s' },
  { name: 'Retry rejected promotion', status: 'Limited', time: '21.4s' },
  { name: 'Proceed to checkout', status: 'Allowed', time: '26.8s' },
  { name: 'Place order', status: 'Confirmation required', time: '31.9s' },
];
