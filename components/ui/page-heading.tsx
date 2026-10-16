import type { ReactNode } from 'react';
const sections: Record<string, string> = {
  'Storefront testing overview': 'Workspace overview',
  'Agent test run': 'Test execution',
  'Shopping sessions': 'Session activity',
  'Session replays': 'Observability',
  'Session replay': 'Session detail',
  'Agent Replay': 'Session detail',
  'Findings & next steps': 'Insights & improvements',
  Security: 'Controls & policies',
  Analytics: 'Performance',
  Integrations: 'Connected tools',
  Settings: 'Workspace management',
  'Demand Signal': 'Product research',
};
export function PageHeading({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || sections[title] || 'Workspace'}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}
