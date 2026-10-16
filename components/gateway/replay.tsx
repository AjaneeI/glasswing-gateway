'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Compass,
  CreditCard,
  Globe2,
  PencilLine,
  Search,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import styles from './replay.module.css';
import { ReplayObservation } from './replay-observation';
import { PageHeading } from '@/components/ui/page-heading';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  StatusBadge,
  Tabs,
} from '@/components/ui/primitives';
import { formatCost, formatTime } from '@/lib/gateway/client';
import type { Session } from '@/lib/gateway/schemas';
import { ErrorNotice, FixtureBadge, OutcomeBadge, useGatewayData } from './shared';
const actionLabels: Record<NonNullable<Session['trace'][number]['action']>['type'], string> = {
  navigate: 'Browse page',
  search: 'Search the store',
  inspect_product: 'Inspect product',
  add_to_cart: 'Add to cart',
  view_cart: 'Open cart',
  begin_checkout: 'Start checkout',
  fill_checkout: 'Fill checkout details',
  stop: 'Finish shopping',
};
const actionIcons: Record<
  NonNullable<Session['trace'][number]['action']>['type'],
  typeof Compass
> = {
  navigate: Compass,
  search: Search,
  inspect_product: ShoppingBag,
  add_to_cart: ShoppingCart,
  view_cart: ShoppingCart,
  begin_checkout: CreditCard,
  fill_checkout: PencilLine,
  stop: CheckCircle2,
};
export function GatewayReplay({ id }: { id: string }) {
  const {
    data: session,
    error,
    loading,
    reload,
  } = useGatewayData<Session>(`/sessions/${encodeURIComponent(id)}`);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState('Trace');
  useEffect(() => {
    if (!session || !['queued', 'running'].includes(session.status)) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status]);
  useEffect(() => {
    if (!session) return;
    const evidence = new URLSearchParams(window.location.search).get('evidence');
    const index = session.trace.findIndex(
      (event) => event.id === evidence || event.observation?.id === evidence,
    );
    if (index >= 0) setSelected(index);
  }, [session?.id]);
  const event = session?.trace[selected];
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `gateway-session-${id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeading
        title="Session replay"
        subtitle={
          session?.scenario.goal ||
          'Load recorded actions, storefront observations, and independent evaluation.'
        }
        action={
          session && (
            <Button variant="outline" onClick={download}>
              Export session JSON
            </Button>
          )
        }
      />
      <ErrorNotice message={error} retry={reload} />
      {loading && !session && <p role="status">Loading session…</p>}
      {session && (
        <div className="gateway-stack">
          <div className={`gateway-toolbar ${styles.sessionSummary}`}>
            <FixtureBadge fixture={session.fixture} />
            <StatusBadge>{session.status}</StatusBadge>
            <OutcomeBadge session={session} />
            <span>
              {session.archetype.name} · {session.scenario.mode}
            </span>
            <Link className="text-link" href={`/scan?scanId=${session.scanId}`}>
              View parent scan →
            </Link>
          </div>
          <ErrorNotice message={session.error?.message || ''} />
          <Card className="gateway-panel">
            <Tabs
              tabs={['Trace', 'Goal & constraints', 'Evaluation', 'Model usage']}
              active={tab}
              onChange={setTab}
            />
          </Card>
          {tab === 'Trace' && (
            <div className={styles.layout}>
              <Card className={styles.timelinePanel}>
                <div className={styles.timelineHeading}>
                  <span className={styles.eyebrow}>SHOPPER JOURNEY</span>
                  <h2>
                    Recorded events <span>{session.trace.length}</span>
                  </h2>
                  <p>Follow each decision through the store.</p>
                </div>
                {session.trace.length ? (
                  <ol className={styles.timeline}>
                    {session.trace.map((item, index) => {
                      const Icon =
                        item.status === 'blocked' || item.status === 'error'
                          ? ShieldAlert
                          : item.action
                            ? actionIcons[item.action.type]
                            : Globe2;
                      return (
                        <li key={item.id}>
                          <button
                            className={styles.eventButton}
                            data-selected={selected === index}
                            onClick={() => setSelected(index)}
                            aria-pressed={selected === index}
                          >
                            <span className={styles.eventIcon}>
                              <Icon size={17} />
                            </span>
                            <span className={styles.eventCopy}>
                              <strong>
                                {item.action
                                  ? actionLabels[item.action.type]
                                  : 'Observe storefront'}
                              </strong>
                              <span className={styles.eventReason}>{item.detail}</span>
                              <small>
                                Step {index + 1} ·{' '}
                                {new Date(item.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}{' '}
                                · {item.status}
                              </small>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <EmptyState
                    title="No events recorded yet"
                    description={
                      session.status === 'queued'
                        ? 'This session is waiting to run.'
                        : 'The session has not captured a browser observation.'
                    }
                  />
                )}
                <Link className={styles.scanLink} href={`/scan?scanId=${session.scanId}`}>
                  Back to scan <ArrowUpRight size={13} />
                </Link>
              </Card>
              <div className={styles.detailColumn}>
                {event ? (
                  <>
                    <Card className={styles.decisionPanel}>
                      <div className={styles.decisionTop}>
                        <div>
                          <span className={styles.eyebrow}>
                            STEP {selected + 1} OF {session.trace.length}
                          </span>
                          <h2>
                            {event.action ? actionLabels[event.action.type] : 'Observe storefront'}
                          </h2>
                        </div>
                        <div className={styles.navigation}>
                          <button
                            aria-label="Previous event"
                            disabled={selected === 0}
                            onClick={() => setSelected(selected - 1)}
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <button
                            aria-label="Next event"
                            disabled={selected >= session.trace.length - 1}
                            onClick={() => setSelected(selected + 1)}
                          >
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.decisionMeta}>
                        <StatusBadge>{event.status}</StatusBadge>
                        <span>{formatTime(event.timestamp)}</span>
                        {event.action?.disposition && (
                          <span className={styles.disposition}>
                            {event.action.disposition === 'recommend'
                              ? 'Product recommended'
                              : 'Shopper declined'}
                          </span>
                        )}
                      </div>
                      <p className={styles.decisionReason}>{event.detail}</p>
                      {event.action?.query && (
                        <div className={styles.searchQuery}>
                          <Search size={15} />
                          <span>Search query</span>
                          <strong>{event.action.query}</strong>
                        </div>
                      )}
                      {event.action?.url && !event.observation && (
                        <a
                          className={styles.actionLink}
                          href={event.action.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {event.action.url}
                          <ArrowUpRight size={13} />
                        </a>
                      )}
                    </Card>
                    {event.observation ? (
                      <ReplayObservation
                        key={event.observation.id}
                        sessionId={session.id}
                        observation={event.observation}
                      />
                    ) : (
                      <Card className={styles.noObservation}>
                        <CheckCircle2 size={22} />
                        <div>
                          <h3>
                            {event.action?.type === 'stop'
                              ? 'Shopping session ended'
                              : 'No page captured for this action'}
                          </h3>
                          <p>
                            {event.action?.type === 'stop'
                              ? 'The shopper’s final decision is recorded above. Select an earlier step to inspect its browser evidence.'
                              : 'Review the recorded status and reason above.'}
                          </p>
                        </div>
                      </Card>
                    )}
                    {event.observation && (
                      <Card className={styles.evidencePanel}>
                        <details>
                          <summary>
                            <BookOpen size={15} />
                            Discovered links <span>{event.observation.links.length}</span>
                          </summary>
                          <div className={styles.links}>
                            {event.observation.links.map((link, index) => (
                              <a key={index} href={link.url} target="_blank" rel="noreferrer">
                                <strong>{link.text || 'Untitled link'}</strong>
                                <span>{link.url}</span>
                                <ArrowUpRight size={13} />
                              </a>
                            ))}
                          </div>
                        </details>
                        <p className={styles.evidenceId}>Evidence ID: {event.observation.id}</p>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card>
                    <EmptyState
                      title="Select a recorded event"
                      description="Browser evidence appears as this shopper explores the storefront."
                    />
                  </Card>
                )}
              </div>
            </div>
          )}
          {tab === 'Goal & constraints' && (
            <Card className="gateway-panel gateway-stack">
              <h2>{session.scenario.goal}</h2>
              <p>
                Archetype: {session.archetype.name} — {session.archetype.hypothesis}
              </p>
              <p>
                Mode: {session.scenario.mode} · Expected outcome: {session.scenario.expectedOutcome}
              </p>
              <h3>Hard constraints</h3>
              {session.scenario.hardConstraints.length ? (
                session.scenario.hardConstraints.map((constraint, i) => (
                  <p key={i}>
                    {constraint.description} ({constraint.kind}: {constraint.value})
                  </p>
                ))
              ) : (
                <p>No additional hard constraints.</p>
              )}
              <h3>Soft preferences</h3>
              {session.scenario.softPreferences.map((preference, i) => (
                <p key={i}>{preference}</p>
              ))}
              <p>Permitted actions: {session.scenario.permittedActions.join(', ')}</p>
              <p>Authorized stop: recommend or decline.</p>
              <p>Source: {session.scenario.provenance.rationale}</p>
            </Card>
          )}
          {tab === 'Evaluation' && (
            <Card>
              <CardHeader title="Independent outcome evaluation" />
              {session.evaluation ? (
                <div className="gateway-panel gateway-stack">
                  <OutcomeBadge session={session} />
                  <h3>Deterministic checks</h3>
                  {session.evaluation.deterministic.map((check) => (
                    <div key={check.name}>
                      <StatusBadge
                        tone={
                          check.result === 'pass'
                            ? 'green'
                            : check.result === 'fail'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {check.result}
                      </StatusBadge>{' '}
                      <strong>{check.name.replaceAll('_', ' ')}</strong>
                      <p>{check.detail}</p>
                    </div>
                  ))}
                  <h3>Independent semantic verdict: {session.evaluation.semantic.verdict}</h3>
                  <p>{session.evaluation.semantic.reason}</p>
                  {session.evaluation.semantic.constraintAssessments.map((assessment) => (
                    <p key={assessment.constraintIndex}>
                      Constraint {assessment.constraintIndex + 1}: {assessment.verdict} —{' '}
                      {assessment.reason}
                    </p>
                  ))}
                  <div className="gateway-toolbar">
                    {session.evaluation.semantic.evidenceIds.map((evidenceId) => (
                      <Button
                        key={evidenceId}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected(
                            session.trace.findIndex((item) => item.observation?.id === evidenceId),
                          );
                          setTab('Trace');
                        }}
                      >
                        View cited observation
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No evaluation available"
                  description={
                    session.error
                      ? 'Execution failed before an evaluation could be completed. Inspect the error and recorded trace.'
                      : 'Evaluation appears after the shopper finishes.'
                  }
                />
              )}
            </Card>
          )}
          {tab === 'Model usage' && (
            <Card>
              <CardHeader title="Recorded model calls" />
              <div className="gateway-table-wrap">
                <table className="gateway-table">
                  <thead>
                    <tr>
                      <th>Purpose</th>
                      <th>Model / prompt</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Tokens in / out</th>
                      <th>Estimated cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.modelCalls.map((call) => (
                      <tr key={call.id}>
                        <td>{call.purpose}</td>
                        <td>
                          {call.model}
                          <small>{call.promptVersion}</small>
                        </td>
                        <td>
                          {call.status}
                          <small>{call.errorCode}</small>
                        </td>
                        <td>{call.attempts}</td>
                        <td>
                          {call.inputTokens} / {call.outputTokens}
                        </td>
                        <td>{formatCost(call.estimatedCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
