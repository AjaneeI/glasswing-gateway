'use client';
import { ArrowUpRight, BookOpen, Check, Link2, Settings2 } from 'lucide-react';
import { BrandLogo } from '@/components/integrations/brand-logo';
import type { Connection, Integration } from '@/lib/integrations/catalog';
import styles from '@/components/integrations/integrations.module.css';
export function IntegrationCard({
  integration,
  connection,
  onConfigure,
  disabled,
}: {
  integration: Integration;
  connection?: Connection;
  onConfigure: () => void;
  disabled: boolean;
}) {
  return (
    <article
      className={`${styles.card} ${connection ? styles.configuredCard : ''}`}
      aria-label={integration.name}
    >
      <div className={styles.cardTop}>
        <BrandLogo integration={integration} />
        <span className={connection ? styles.configured : styles.category}>
          {connection ? (
            <>
              <Check size={12} />
              Configured
            </>
          ) : (
            integration.category
          )}
        </span>
      </div>
      <h3>{integration.name}</h3>
      <p className={styles.description}>{integration.description}</p>
      <div className={styles.capability}>
        <span />
        {integration.capability}
      </div>
      {connection && (
        <a
          className={styles.destination}
          href={connection.url}
          target="_blank"
          rel="noopener noreferrer"
          title={connection.url}
        >
          <Link2 size={14} />
          <span>
            <strong>{connection.name}</strong>
            <small>{new URL(connection.url).hostname}</small>
          </span>
          <ArrowUpRight size={15} />
        </a>
      )}
      <div className={styles.cardFooter}>
        <a
          href={integration.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.docs}
          aria-label={`${integration.name} documentation`}
        >
          <BookOpen size={14} />
          Docs
          <ArrowUpRight size={12} />
        </a>
        <div className={styles.cardActions}>
          {connection ? (
            <>
              <button
                className={styles.iconButton}
                onClick={onConfigure}
                disabled={disabled}
                aria-label={`Configure ${integration.name}`}
              >
                <Settings2 size={15} />
              </button>
              <a
                className={styles.openButton}
                href={connection.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${integration.name}`}
              >
                Open {integration.name === 'CI/CD Webhook' ? 'pipeline' : integration.name}
                <ArrowUpRight size={14} />
              </a>
            </>
          ) : (
            <button
              className={styles.configureButton}
              onClick={onConfigure}
              disabled={disabled}
              aria-label={`Configure ${integration.name}`}
            >
              Configure
              <Link2 size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
