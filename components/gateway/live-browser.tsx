'use client';
import { useState } from 'react';
import { ArrowUpRight, Camera, Globe2, Monitor, UserRound } from 'lucide-react';
import type { Scan } from '@/lib/gateway/schemas';
import styles from './live-browser.module.css';
export function LiveBrowser({ scan }: { scan: Scan }) {
  const [selected, setSelected] = useState('');
  const [failed, setFailed] = useState('');
  const session =
    scan.sessions.find((s) => s.id === selected) ||
    scan.sessions.find((s) => s.status === 'running') ||
    scan.sessions[0];
  const observation = session?.trace
    .slice()
    .reverse()
    .find((event) => event.observation?.screenshotAvailable)?.observation;
  const image =
    observation && session
      ? `/api/gateway/sessions/${session.id}/screenshot?observation=${encodeURIComponent(observation.id)}`
      : '';
  const running = scan.status === 'running' || scan.status === 'queued';
  const latestObservation = session?.trace.findLast((event) => event.observation)?.observation;
  return (
    <section className={styles.panel} aria-label="Live browser preview">
      <div className={styles.heading}>
        <span className={styles.icon}>
          <Monitor size={20} />
        </span>
        <div>
          <h3>Shopper’s browser</h3>
          <p>
            {running
              ? 'Latest captured view · refreshes after each observed page change'
              : image
                ? 'Last captured view from this scan'
                : 'This session has no saved browser frames'}
          </p>
        </div>
        <span className={styles.badge}>
          <Camera size={12} />
          {running ? 'Live snapshots' : image ? 'Recorded snapshot' : 'No captured frames'}
        </span>
      </div>
      <div className={styles.tabs} role="group" aria-label="Choose shopper preview">
        {scan.sessions.map((item, index) => (
          <button
            key={item.id}
            aria-pressed={session?.id === item.id}
            onClick={() => setSelected(item.id)}
          >
            <UserRound size={13} />
            <span>Shopper {index + 1}</span>
            <small>{item.status}</small>
          </button>
        ))}
      </div>
      <div className={styles.address}>
        <span className={styles.dots}>
          <i />
          <i />
          <i />
        </span>
        <Globe2 size={13} />
        <span>{observation?.url || latestObservation?.url || scan.draft.merchantUrl}</span>
        {image && (
          <a
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full screenshot"
          >
            <ArrowUpRight size={15} />
          </a>
        )}
      </div>
      <div className={styles.viewport}>
        {image && failed !== image ? (
          <img
            key={image}
            src={image}
            alt={`Captured browser view for ${session?.archetype.name}: ${observation?.title || observation?.url}`}
            onError={() => setFailed(image)}
          />
        ) : (
          <div className={styles.empty}>
            <Monitor size={35} />
            <h4>
              {image
                ? 'This frame could not be loaded'
                : running
                  ? 'Waiting for a captured frame'
                  : 'No screenshot recorded'}
            </h4>
            <p>
              {image
                ? 'The session trace is still available below.'
                : running
                  ? 'The actual storefront will appear after this shopper observes a page.'
                  : 'No browser frames were saved for this session. Its page observations and action trace are available below.'}
            </p>
            {image && <button onClick={() => setFailed('')}>Retry frame</button>}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <strong>{session?.archetype.name || 'No shopper selected'}</strong>
        <span>
          {observation
            ? `Captured ${new Date(observation.timestamp).toLocaleTimeString()}`
            : 'No frame yet'}
        </span>
        <span>1280 × 900 viewport</span>
      </div>
    </section>
  );
}
