'use client';
import { useState } from 'react';
import { ArrowUpRight, Camera, FileText, Globe2 } from 'lucide-react';
import type { Observation } from '@/lib/gateway/schemas';
import styles from './replay.module.css';

export function ReplayObservation({
  sessionId,
  observation,
}: {
  sessionId: string;
  observation: Observation;
}) {
  const [failed, setFailed] = useState(false);
  const image = `/api/gateway/sessions/${encodeURIComponent(sessionId)}/screenshot?observation=${encodeURIComponent(observation.id)}`;
  const hasImage = observation.screenshotAvailable && !failed;
  return (
    <section className={styles.browser} aria-label="Recorded browser observation">
      <div className={styles.browserHeader}>
        <div>
          <Globe2 size={17} />
          <strong>{observation.title || 'Storefront observation'}</strong>
        </div>
        <span>
          {hasImage ? <Camera size={13} /> : <FileText size={13} />}
          {hasImage ? 'Captured screenshot' : 'Recorded page text'}
        </span>
      </div>
      <div className={styles.address}>
        <span className={styles.dots}>● ● ●</span>
        <a href={observation.url} target="_blank" rel="noreferrer">
          {observation.url}
          <ArrowUpRight size={13} />
        </a>
      </div>
      {hasImage ? (
        <a
          className={styles.frame}
          href={image}
          target="_blank"
          rel="noreferrer"
          aria-label="Open captured screenshot"
        >
          <img
            src={image}
            alt={`Recorded storefront: ${observation.title || observation.url}`}
            onError={() => setFailed(true)}
          />
        </a>
      ) : (
        <div className={styles.textPreview}>
          <p className={styles.textNotice}>
            {failed
              ? 'The saved frame could not be loaded. Showing the recorded page text.'
              : 'This observation has no saved screenshot. This is the text captured from the page.'}
          </p>
          <div>
            {observation.text
              .split('\n')
              .map((line, index) => (line.trim() ? <p key={index}>{line}</p> : null))}
          </div>
        </div>
      )}
      <div className={styles.browserFooter}>
        <span>Captured {new Date(observation.timestamp).toLocaleTimeString()}</span>
        <span>{observation.kind === 'product' ? 'Product observation' : 'Page observation'}</span>
      </div>
      {observation.products.length > 0 && (
        <div className={styles.products}>
          {observation.products.map((product, index) => (
            <div key={index}>
              <span className={styles.eyebrow}>OBSERVED PRODUCT</span>
              <strong>{product.name}</strong>
              <span>
                {product.price != null
                  ? `${product.price} ${product.currency || ''}`
                  : 'Price not captured'}
              </span>
            </div>
          ))}
        </div>
      )}
      {hasImage && (
        <details className={styles.pageText}>
          <summary>Read captured page text</summary>
          <pre>{observation.text}</pre>
        </details>
      )}
    </section>
  );
}
