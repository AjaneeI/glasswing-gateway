export type SiteStatus = 'Agent-ready' | 'Needs work' | 'Not agent-ready';

export interface DirectorySite {
  id: string;
  name: string;
  domain: string;
  category: string;
  score: number;
  status: SiteStatus;
  products: number;
  openFindings: number;
  lastScan: string;
  protocols: string[];
}

export const directory: DirectorySite[] = [
  {
    id: 'evertrail',
    name: 'Evertrail Outdoors',
    domain: 'evertrailoutdoors.com',
    category: 'Outdoor equipment',
    score: 74,
    status: 'Needs work',
    products: 72,
    openFindings: 4,
    lastScan: 'Today, 11:42 AM',
    protocols: ['Structured data', 'Agent checkout'],
  },
  {
    id: 'summit-pine',
    name: 'Summit & Pine',
    domain: 'summitandpine.com',
    category: 'Outdoor apparel',
    score: 91,
    status: 'Agent-ready',
    products: 214,
    openFindings: 1,
    lastScan: 'Today, 9:18 AM',
    protocols: ['Structured data', 'Agent checkout', 'Agent identity', 'Machine policies'],
  },
  {
    id: 'basecamp',
    name: 'Basecamp Supply Co.',
    domain: 'basecampsupply.com',
    category: 'Camping gear',
    score: 88,
    status: 'Agent-ready',
    products: 340,
    openFindings: 2,
    lastScan: 'Yesterday, 4:05 PM',
    protocols: ['Structured data', 'Agent checkout', 'Machine policies'],
  },
  {
    id: 'alpine-republic',
    name: 'Alpine Republic',
    domain: 'alpinerepublic.com',
    category: 'Ski & snow',
    score: 85,
    status: 'Agent-ready',
    products: 156,
    openFindings: 2,
    lastScan: 'Yesterday, 1:30 PM',
    protocols: ['Structured data', 'Agent identity'],
  },
  {
    id: 'cascade',
    name: 'Cascade Provisions',
    domain: 'cascadeprovisions.com',
    category: 'Food & beverage',
    score: 79,
    status: 'Needs work',
    products: 88,
    openFindings: 3,
    lastScan: 'Sep 24, 10:12 AM',
    protocols: ['Structured data', 'Agent checkout'],
  },
  {
    id: 'urban-trek',
    name: 'Urban Trek',
    domain: 'urbantrek.com',
    category: 'Footwear',
    score: 69,
    status: 'Needs work',
    products: 122,
    openFindings: 5,
    lastScan: 'Sep 24, 8:44 AM',
    protocols: ['Structured data'],
  },
  {
    id: 'trailhead-market',
    name: 'Trailhead Market',
    domain: 'trailheadmarket.com',
    category: 'Hiking gear',
    score: 63,
    status: 'Needs work',
    products: 61,
    openFindings: 7,
    lastScan: 'Sep 23, 3:20 PM',
    protocols: ['Structured data'],
  },
  {
    id: 'ridgeline-goods',
    name: 'Ridgeline Goods',
    domain: 'ridgelinegoods.com',
    category: 'Apparel',
    score: 58,
    status: 'Needs work',
    products: 190,
    openFindings: 6,
    lastScan: 'Sep 23, 11:02 AM',
    protocols: ['Agent checkout'],
  },
  {
    id: 'northwind',
    name: 'Northwind Outfitters',
    domain: 'northwindoutfitters.com',
    category: 'Outdoor equipment',
    score: 42,
    status: 'Not agent-ready',
    products: 47,
    openFindings: 11,
    lastScan: 'Sep 22, 5:47 PM',
    protocols: [],
  },
  {
    id: 'pinecrest',
    name: 'Pinecrest Gear',
    domain: 'pinecrestgear.com',
    category: 'Camping gear',
    score: 37,
    status: 'Not agent-ready',
    products: 29,
    openFindings: 9,
    lastScan: 'Sep 22, 2:15 PM',
    protocols: [],
  },
];