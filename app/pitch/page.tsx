'use client';
import { PageHeading } from '@/components/ui/page-heading';
import { Card, CardHeader, Tabs } from '@/components/ui/primitives';
import { Check, ShoppingBag, Store, X } from 'lucide-react';
import { useState } from 'react';

interface Point {
  label?: string;
  text: string;
}
interface Section {
  number: string;
  category: string;
  answer: string;
  points: Point[];
}

const sections: Section[] = [
  {
    number: '01',
    category: 'Customer Problem',
    answer: 'Merchants need evidence of how autonomous shoppers interpret their storefronts.',
    points: [
      {
        label: 'Genuine or emerging?',
        text: 'The prototype explores a specific question: can a shopper agent understand a storefront and satisfy a reviewed goal? This page does not establish market size or adoption rates.',
      },
      {
        label: 'Who feels it, and why?',
        text: 'Proposed users are commerce engineering and QA teams that want to inspect agent behavior on an authorized test storefront. Customer demand remains a hypothesis.',
      },
      {
        label: 'Already a workflow companies pay for?',
        text: 'Gateway organizes storefront inspection, reviewed scenarios, bounded execution, and investigation. Paid adoption and replacement of existing QA work have not been demonstrated.',
      },
      {
        label: 'Why now?',
        text: 'Agent-driven browsing creates testable questions about navigation, product evidence, and goal satisfaction. This archive focuses on those questions.',
      },
    ],
  },
  {
    number: '02',
    category: 'Business Case',
    answer: 'The proposed value is a repeatable test with evidence a merchant can investigate.',
    points: [
      {
        label: 'Intended use:',
        text: 'support manual storefront QA with merchant-reviewed shopping scenarios and inspectable results.',
      },
      {
        label: 'Measurable outcome:',
        text: 'recorded execution state, independent goal evaluation, evidence-linked findings, and model usage. Revenue improvement and engineering time saved are not measured outcomes here.',
      },
      {
        label: 'Improves workflow:',
        text: 'keeps review, execution, replay, and findings in one prototype workspace. A production CI/CD gate is not established by this archive.',
      },
      {
        label: 'Willingness to pay:',
        text: 'a commercial hypothesis requiring customer validation; no sales or budget evidence is claimed.',
      },
    ],
  },
  {
    number: '03',
    category: 'Operational Fit',
    answer:
      'Operators configure authorized environments; merchants review the plan before execution.',
    points: [
      {
        label: 'Users:',
        text: 'engineering and QA teams shipping the storefront. Buyer: digital commerce or engineering leadership.',
      },
      {
        label: 'Fits existing systems:',
        text: 'the connected workflow runs in a persistent Node process against exact configured origins. Default shopper actions end at recommendation or decline. Public-storefront checks require explicit authorization.',
      },
      {
        label: 'Adoption barriers, honestly:',
        text: 'the shopper does not represent every commercial shopping agent. A separate evaluator assesses recorded evidence; its configured model may be the same model family as the shopper. Findings offer investigation guidance, not automatically generated or applied fixes.',
      },
      {
        label: 'Beyond the prototype:',
        text: 'distributed execution, a lightweight SDK, native commerce connectors, and production rollout controls would require further development and validation.',
      },
    ],
  },
  {
    number: '04',
    category: 'AI Differentiation',
    answer:
      'Agent traces complement static checks with evidence of navigation and goal interpretation.',
    points: [
      {
        label: 'Core task:',
        text: "open-ended goal interpretation, multi-step autonomous navigation, and judgment about whether an action matches the shopper's intent — not a fixed rule set. (See the toggle above.)",
      },
      {
        text: 'The connected workflow uses configured OpenAI models for scenario synthesis, shopper decisions, independent evaluation, and finding summaries. Fixture mode uses explicitly labeled scripted outputs.',
      },
      {
        label: 'Evolves with better models:',
        text: 'model IDs are configured by the operator. This archive does not establish a live side-by-side provider benchmark.',
      },
      {
        label: 'Evidence retained:',
        text: 'sessions retain bounded observations, actions, and evaluations for investigation. A representative benchmark dataset or competitive data advantage has not been established.',
      },
    ],
  },
];

const checklist = ['Product schema', 'Meta description', 'robots.txt', 'Returns policy'];

const audiences = [
  {
    tier: 'Start here',
    who: 'Mid-market and enterprise merchants running headless or custom storefronts',
    detail:
      'A proposed starting segment for customer research. Compatibility with these platforms and willingness to pay need validation.',
  },
  {
    tier: 'Expand',
    who: 'The broader mid-market on standard platform storefronts',
    detail: 'A possible later segment. Demand and urgency have not been measured in this project.',
  },
  {
    tier: 'Channel',
    who: 'Commerce platforms — Shopify, Wix, Squarespace, BigCommerce, commercetools',
    detail:
      'A possible distribution model requiring partnerships and platform integration work. No such partnership is claimed.',
  },
];

function PointList({ points }: { points: Point[] }) {
  return (
    <ul className="pitch-points">
      {points.map((point) => (
        <li key={point.text}>
          {point.label && <span className="pitch-point-label">{point.label}</span>}
          <p>{point.text}</p>
        </li>
      ))}
    </ul>
  );
}

function StorefrontMock({ live }: { live: boolean }) {
  return (
    <div className="pitch-mock">
      <div className="pitch-mock-bar">
        <span className="pitch-mock-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="pitch-mock-url">evertrailoutdoors.com/products/summit-trail-45l</span>
        {live && (
          <span className="pitch-mock-live">
            <span className="live-dot" />
            Illustrative session
          </span>
        )}
      </div>
      <div className="pitch-mock-body">
        <span className="pitch-mock-photo" />
        <div className="pitch-mock-details">
          <strong>Summit Trail 45L Backpack</strong>
          <span>$199.00</span>
          <button type="button" className="pitch-mock-cart" tabIndex={-1} aria-hidden="true">
            <ShoppingBag size={12} />
            Add to cart
          </button>
        </div>
        {live && (
          <div className="pitch-mock-overlay">
            <span className="pitch-mock-overlay-close">
              <X size={11} />
            </span>
            <strong>Get 10% off your first order</strong>
            <span>Join the Evertrail newsletter</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PitchPage() {
  const [mode, setMode] = useState('Static checklist');
  const live = mode === 'Agent illustration';
  return (
    <>
      <PageHeading
        title="Why This Matters"
        subtitle="Prototype concept and business hypotheses. Illustrations below are not measured results."
      />
      <div className="pitch-banner pitch-enter">
        <p>Reviewed shopping goals. Observable execution. Evidence for investigation.</p>
      </div>
      {sections.map((section, index) => (
        <Card
          key={section.number}
          className="pitch-section pitch-enter"
          style={{ animationDelay: `${(index + 1) * 120}ms` }}
        >
          <CardHeader
            title={section.answer}
            icon={<span className="pitch-number">{section.number}</span>}
            action={<span className="subtle-badge">{section.category}</span>}
          />
          <div className="pitch-body">
            {section.number === '04' && (
              <div className="pitch-demo">
                <Tabs
                  tabs={['Static checklist', 'Agent illustration']}
                  active={mode}
                  onChange={setMode}
                />
                <div className="pitch-demo-stage" key={mode}>
                  <StorefrontMock live={live} />
                  {live ? (
                    <p className="pitch-agent-result">
                      Illustrative result: An overlay blocks the shopper.
                    </p>
                  ) : (
                    <div className="pitch-checklist">
                      {checklist.map((item) => (
                        <span key={item}>
                          <Check size={12} />
                          {item}
                        </span>
                      ))}
                      <strong>Illustrative checklist score: 100</strong>
                    </div>
                  )}
                </div>
                <small className="pitch-demo-note">
                  Illustrative example. Sessions and Replays identify recorded runs and label
                  fixtures.
                </small>
              </div>
            )}
            <PointList points={section.points} />
          </div>
        </Card>
      ))}
      <Card
        className="pitch-section pitch-enter"
        style={{ animationDelay: `${(sections.length + 1) * 120}ms` }}
      >
        <CardHeader
          title="Proposed customer segments to validate."
          icon={
            <span className="pitch-number">
              <Store size={13} />
            </span>
          }
          action={<span className="subtle-badge">Customer hypotheses</span>}
        />
        <div className="pitch-body">
          <div className="pitch-audiences">
            {audiences.map((audience) => (
              <div className="pitch-audience" key={audience.tier}>
                <span className="pitch-audience-tier">{audience.tier}</span>
                <div>
                  <strong>{audience.who}</strong>
                  <p>{audience.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <small className="pitch-demo-note">
            These segments describe the pitch, not validated customer adoption or platform coverage.
          </small>
        </div>
      </Card>
    </>
  );
}
