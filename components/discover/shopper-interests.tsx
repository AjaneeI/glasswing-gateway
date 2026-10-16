'use client';
import { useApp } from '@/components/layout/app-provider';
import { shopperInterests } from '@/lib/agent/interests';
import { Check, Sparkles } from 'lucide-react';
import styles from './discover.module.css';
export function ShopperInterests() {
  const { scanConfig, setScanConfig } = useApp();
  const selectedInterests = shopperInterests.filter((item) =>
    scanConfig.interests?.includes(item.id),
  );
  const toggleInterest = (id: string) => {
    const current = scanConfig.interests || [];
    setScanConfig({
      ...scanConfig,
      interests: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    });
  };
  return (
    <section
      className={`${styles.interestPanel} ${styles.workflowInterests}`}
      aria-labelledby="interest-heading"
    >
      <div className={styles.interestHeading}>
        <div>
          <span className={styles.kicker}>01 · SHOPPER CONTEXT</span>
          <h2 id="interest-heading">What are they shopping for?</h2>
          <p>Optional context for your next storefront inspection.</p>
        </div>
        <span className={styles.selectionCount}>
          {selectedInterests.length
            ? `${selectedInterests.length} selected`
            : 'Optional · pick any'}
        </span>
      </div>
      <div className={styles.interestGrid} role="group" aria-label="Shopper interests">
        {shopperInterests.map((interest) => {
          const selected = scanConfig.interests?.includes(interest.id) || false;
          return (
            <button
              type="button"
              key={interest.id}
              className={styles.interestCard}
              aria-label={interest.label}
              aria-pressed={selected}
              onClick={() => toggleInterest(interest.id)}
            >
              <img src={interest.image} alt="" />
              <span className={styles.interestCheck}>
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
              <span className={styles.interestCopy}>
                <strong>{interest.label}</strong>
                <span>{interest.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.contextFooter}>
        <Sparkles size={14} />
        <span>
          {selectedInterests.length
            ? `The next test plan will consider ${selectedInterests.map((item) => item.label.toLowerCase()).join(', ')}.`
            : 'Leave this open-ended, or select interests to personalize the goals.'}
        </span>
        {selectedInterests.length > 0 && (
          <button onClick={() => setScanConfig({ ...scanConfig, interests: [] })}>Clear</button>
        )}
      </div>
    </section>
  );
}
