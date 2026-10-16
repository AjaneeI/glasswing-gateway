'use client';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  Globe2,
  Loader2,
  Radar,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { Scan } from '@/lib/gateway/schemas';
import styles from './scan-execution.module.css';
import { LiveBrowser } from './live-browser';
const terminal = (status: string) => !['queued', 'running'].includes(status);
const readable = (value: string) => value.replaceAll('_', ' ');
export function ScanExecution({ scan }: { scan: Scan }) {
  const total = scan.sessions.length;
  const finished = scan.sessions.filter((s) => terminal(s.status)).length;
  const running = scan.sessions.filter((s) => s.status === 'running').length;
  const evaluated = scan.sessions.filter((s) => s.evaluation).length;
  const active = scan.status === 'running';
  const interrupted = ['failed', 'interrupted'].includes(scan.status);
  const percent = total ? Math.round((finished / total) * 100) : 0;
  const title =
    scan.status === 'completed'
      ? 'Scan complete'
      : active
        ? 'Shoppers are exploring'
        : interrupted
          ? 'Scan needs attention'
          : 'Your shoppers are ready';
  const events = scan.sessions
    .flatMap((session) => session.trace.map((event) => ({ ...event, session })))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 4);
  const stages = [
    {
      name: 'Plan approved',
      detail: `Revision ${scan.draft.revision}`,
      done: !!scan.draft.approvedAt,
      current: false,
      icon: FileCheck2,
    },
    {
      name: 'Shopper sessions',
      detail: `${finished} of ${total} finished`,
      done: total > 0 && finished === total,
      current: active && finished < total,
      icon: UserRound,
    },
    {
      name: 'Evaluate results',
      detail: `${evaluated} of ${total} evaluated`,
      done: total > 0 && evaluated === total,
      current: active && evaluated < total && finished > 0,
      icon: ShieldCheck,
    },
    {
      name: 'Review findings',
      detail: terminal(scan.status)
        ? `${scan.findings.length} findings recorded`
        : 'When execution finishes',
      done: scan.status === 'completed',
      current: false,
      icon: CheckCircle2,
    },
  ];
  return (
    <div className={styles.stack}>
      <section className={styles.execution} aria-label="Scan execution">
        <div className={styles.topline}>
          <span>
            <Radar size={15} />
            SCAN EXECUTION
          </span>
          <span
            className={`${styles.status} ${active ? styles.live : interrupted ? styles.warning : ''}`}
          >
            {active && <i />}
            {readable(scan.status)}
            {scan.fixture && <small>Fixture</small>}
          </span>
        </div>
        <div className={styles.overview}>
          <div
            className={styles.ring}
            role="progressbar"
            aria-label="Shopping session progress"
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-valuenow={finished}
            aria-valuetext={`${finished} of ${total} sessions finished`}
          >
            <svg viewBox="0 0 132 132" aria-hidden="true">
              <circle cx="66" cy="66" r="55" className={styles.track} />
              <circle
                cx="66"
                cy="66"
                r="55"
                className={`${styles.fill} ${interrupted ? styles.interrupted : ''}`}
                strokeDasharray={345.58}
                strokeDashoffset={345.58 * (1 - finished / Math.max(total, 1))}
              />
            </svg>
            <div>
              <strong>
                {percent}
                <small>%</small>
              </strong>
              <span>finished</span>
            </div>
          </div>
          <div className={styles.overviewText}>
            <h2>{title}</h2>
            <p>
              {active
                ? 'Following your approved goals, one shopping decision at a time.'
                : scan.status === 'completed'
                  ? 'Explore the session traces and independently evaluated outcomes below.'
                  : interrupted
                    ? 'Inspect the recorded sessions for errors and unfinished work.'
                    : 'Execution begins with your approved shopping scenarios.'}
            </p>
            <div className={styles.host}>
              <Globe2 size={13} />
              {new URL(scan.draft.merchantUrl).hostname}
              <span>·</span>
              <span>{scan.draft.environmentId}</span>
            </div>
          </div>
          <div className={styles.counters}>
            <div>
              <span className={styles.activeDot} />
              <strong>{running}</strong>
              <span>running</span>
            </div>
            <div>
              <CheckCircle2 size={14} />
              <strong>{finished}</strong>
              <span>finished</span>
            </div>
            <div>
              <FileCheck2 size={14} />
              <strong>{scan.findings.length}</strong>
              <span>findings</span>
            </div>
          </div>
        </div>
        <div className={styles.stages}>
          {stages.map((stage, index) => (
            <div
              key={stage.name}
              className={`${styles.stage} ${stage.done ? styles.done : stage.current ? styles.current : ''}`}
            >
              <span className={styles.stageIcon}>
                {stage.done ? <Check size={16} /> : <stage.icon size={17} />}
              </span>
              <div>
                <strong>{stage.name}</strong>
                <small>{stage.detail}</small>
              </div>
              {index < stages.length - 1 && <ArrowRight className={styles.connector} size={15} />}
            </div>
          ))}
        </div>
        <div className={styles.bottomline}>
          <span role="status" aria-live="polite">
            {finished} / {total} sessions finished
          </span>
          <span>Scan {scan.id.slice(0, 8)}</span>
          <Link href={`/sessions?scanId=${scan.id}`}>
            View sessions
            <ArrowUpRight size={13} />
          </Link>
          <Link href={`/discover?draft=${scan.draft.id}`}>
            Review test plan
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </section>
      <LiveBrowser scan={scan} />
      <section className={styles.sessions} aria-label="Shopper sessions">
        <div className={styles.sectionTitle}>
          <div>
            <h3>
              Shopper sessions <span>{total}</span>
            </h3>
            <p>Each shopper runs independently against your approved test plan.</p>
          </div>
          {active && (
            <span className={styles.updating}>
              <Activity size={13} />
              Live updates
            </span>
          )}
        </div>
        <div className={styles.sessionGrid}>
          {scan.sessions.map((session, index) => {
            const last = session.trace.at(-1);
            const outcome = session.evaluation?.outcome;
            const isRunning = session.status === 'running';
            return (
              <article
                className={`${styles.session} ${isRunning ? styles.runningSession : ''}`}
                key={session.id}
              >
                <div className={styles.sessionTop}>
                  <span className={styles.avatar}>
                    <UserRound size={18} />
                  </span>
                  <div>
                    <small>SHOPPER {String(index + 1).padStart(2, '0')}</small>
                    <h4>{session.archetype.name}</h4>
                  </div>
                  <span className={styles.sessionState}>
                    {isRunning ? (
                      <Loader2 className={styles.spin} size={14} />
                    ) : session.status === 'completed' ? (
                      <CheckCircle2 size={14} />
                    ) : terminal(session.status) ? (
                      <XCircle size={14} />
                    ) : (
                      <Clock3 size={14} />
                    )}
                    {readable(session.status)}
                  </span>
                </div>
                <span className={styles.mode}>{readable(session.scenario.mode)}</span>
                <p className={styles.goal}>{session.scenario.goal}</p>
                <div className={styles.latest}>
                  <span>
                    {isRunning
                      ? 'LATEST ACTIVITY'
                      : terminal(session.status)
                        ? 'LAST RECORDED ACTIVITY'
                        : 'WAITING TO START'}
                  </span>
                  <p>
                    {last?.detail ||
                      (isRunning
                        ? 'Waiting for the first recorded observation…'
                        : 'No actions recorded yet.')}
                  </p>
                </div>
                <div className={styles.sessionFoot}>
                  <span
                    className={
                      outcome === 'passed'
                        ? styles.passed
                        : outcome === 'failed'
                          ? styles.failed
                          : styles.pending
                    }
                  >
                    {outcome === 'passed' ? <CheckCircle2 size={13} /> : <Circle size={11} />}
                    {outcome
                      ? readable(outcome)
                      : terminal(session.status)
                        ? 'Not evaluated'
                        : 'Evaluation pending'}
                  </span>
                  <Link href={`/replays/${session.id}`}>
                    Replay ({session.trace.length})<ArrowUpRight size={13} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        {!total && (
          <p className={styles.noEvents}>No shopper sessions have been recorded for this scan.</p>
        )}
      </section>
      <section className={styles.activity}>
        <div className={styles.activityHeading}>
          <Activity size={16} />
          <h3>Latest activity</h3>
          <span>
            {active ? 'Updating as actions are recorded' : 'Most recent recorded actions'}
          </span>
        </div>
        {events.length ? (
          <ol>
            {events.map((event) => (
              <li key={`${event.session.id}-${event.id}`}>
                <span
                  className={
                    event.status === 'error' || event.status === 'blocked'
                      ? styles.eventWarning
                      : styles.eventDot
                  }
                />
                <time dateTime={event.timestamp}>
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <div>
                  <strong>{event.session.archetype.name}</strong>
                  <p>{event.detail}</p>
                </div>
                <Link
                  href={`/replays/${event.session.id}?evidence=${encodeURIComponent(event.id)}`}
                  aria-label={`Inspect action ${event.sequence} for ${event.session.archetype.name}`}
                >
                  <ArrowUpRight size={15} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.noEvents}>
            Recorded shopper actions will appear here when execution begins.
          </p>
        )}
      </section>
      <p className={styles.boundary}>
        <ShieldCheck size={14} />
        Shoppers stop at a recommendation or decline. Session outcomes are evaluated independently.
      </p>
    </div>
  );
}
