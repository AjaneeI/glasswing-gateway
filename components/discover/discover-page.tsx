'use client';
import { useApp } from '@/components/layout/app-provider';
import { GatewayLogo } from '@/components/layout/app-shell';
import { GatewayWorkflow } from '@/components/gateway/workflow';
import { ShopperInterests } from './shopper-interests';
import styles from './discover.module.css';
export function DiscoverPage() {
  const { scanConfig } = useApp();
  return (
    <div className="portal-page">
      <header className="portal-brand">
        <span className="portal-logo">
          <GatewayLogo />
          <strong>Gateway</strong>
        </span>
        <span className="portal-brand-note">Autonomous shopper testing</span>
      </header>
      <section className={`discover-hero ${styles.hero}`}>
        <div className="discover-eyebrow">Storefront testing</div>
        <h1>Understand your storefront through your shoppers.</h1>
        <p>
          Inspect an authorized storefront, review customer hypotheses and shopping goals, then
          observe isolated agents attempting them.
        </p>
      </section>
      <ShopperInterests />
      <nav className={styles.workflowSteps} aria-label="Storefront test workflow">
        {['Inspect storefront', 'Review test plan', 'Observe & improve'].map((label, index) => (
          <span key={label}>
            <strong>0{index + 1}</strong>
            {label}
          </span>
        ))}
      </nav>
      <GatewayWorkflow shopperInterests={scanConfig.interests || []} />
    </div>
  );
}
