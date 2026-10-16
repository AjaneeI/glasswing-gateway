'use client';
import { useApp } from '@/components/layout/app-provider';
import { SecurityPolicyList } from '@/components/security/security-policy-list';
import { PageHeading } from '@/components/ui/page-heading';
import { Button, Card, CardHeader, Dialog, StatusBadge, Tabs } from '@/components/ui/primitives';
import { getSessionEvents } from '@/lib/mock-data/sessions';
import type { ShoppingSession } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Fingerprint,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Target,
  Terminal,
  Video,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AgentTimeline } from './agent-timeline';
import { ReplayScreen } from './replay-screen';
export function ReplayPage({ session }: { session: ShoppingSession }) {
  const events = useMemo(() => getSessionEvents(session), [session]);
  const [tab, setTab] = useState('Timeline');
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [allEvents, setAllEvents] = useState(false);
  const [watchingReplay, setWatchingReplay] = useState(false);
  const [focusEventId, setFocusEventId] = useState(
    () => events.find((event) => event.type === 'warning')?.id ?? events[0]?.id ?? 1,
  );
  const { notify } = useApp();
  const featured = session.id === 'SES-10482';
  const currentEvent = events.find((event) => event.id === step) ?? events[0];
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setStep((s) => {
          if (s >= events.length) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      800,
    );
    return () => clearInterval(t);
  }, [playing, events.length]);
  useEffect(() => {
    if (step > 0) setFocusEventId(step);
  }, [step]);
  const focusEvent = events.find((event) => event.id === focusEventId) ?? events[0];
  const visualState = getReplayVisualState(focusEvent?.id ?? 1);
  const diagnosis = getReplayDiagnosis(focusEvent);
  const exportTrace = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ session, events }, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.id}-trace.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Session trace exported.');
  };
  return (
    <>
      <Link href="/sessions" className="back-link">
        <ArrowLeft size={13} />
        All shopping sessions
      </Link>
      <PageHeading
        title="Agent Replay"
        subtitle="Follow the agent journey, inspect merchant evidence, and diagnose exactly where friction appeared."
        action={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (step >= events.length) setStep(0);
                setWatchingReplay(true);
              }}
            >
              <Video size={14} />
              Watch visual replay
            </Button>
            <Button variant="outline" onClick={exportTrace}>
              <Download size={14} />
              Export trace
            </Button>
          </>
        }
      />
      <Card className="replay-metadata">
        <div>
          <span>SESSION</span>
          <strong className="mono">{session.id}</strong>
        </div>
        <div>
          <span>STOREFRONT</span>
          <strong>Evertrail Outdoors</strong>
        </div>
        <div>
          <span>STARTED</span>
          <strong>
            Sep {session.date.slice(-2)}, 2026 · {session.timestamp}
          </strong>
        </div>
        <div>
          <span>DURATION</span>
          <strong className="mono">
            {featured ? '34.2' : session.duration} {featured && 'sec'}
          </strong>
        </div>
        <div>
          <span>STATUS</span>
          <StatusBadge
            tone={session.status === 'Completed' ? (session.issues ? 'amber' : 'green') : 'red'}
          >
            {session.status === 'Completed' && session.issues
              ? 'Completed with warnings'
              : session.status}
          </StatusBadge>
        </div>
      </Card>
      <Card className="replay-investigation">
        <CardHeader
          title="Investigation view"
          subtitle="Select a journey step to inspect the storefront state and diagnosis."
          action={
            <StatusBadge tone={session.issues ? 'amber' : 'green'}>
              {session.issues} {session.issues === 1 ? 'issue' : 'issues'} detected
            </StatusBadge>
          }
        />
        <div className="investigation-grid">
          <section className="journey-rail" aria-label="Agent journey">
            <span className="investigation-label">JOURNEY</span>
            <div className="journey-steps">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={focusEvent?.id === event.id ? 'active' : ''}
                  aria-pressed={focusEvent?.id === event.id}
                  onClick={() => {
                    setPlaying(false);
                    setFocusEventId(event.id);
                  }}
                >
                  <span
                    className={
                      event.type === 'warning'
                        ? 'warning'
                        : event.type === 'complete'
                          ? 'success'
                          : ''
                    }
                  >
                    {event.id}
                  </span>
                  <span>
                    <small>{event.time}s</small>
                    <strong>{event.title}</strong>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="storefront-state" aria-labelledby="storefront-state-title">
            <div className="investigation-section-heading">
              <span className="investigation-label">STOREFRONT STATE</span>
              <span className="subtle-badge">{visualState.context}</span>
            </div>
            <div className="storefront-browser">
              <div className="storefront-browser-bar">
                <span />
                <span />
                <span />
                <code>evertrailoutdoors.com</code>
              </div>
              <div className="storefront-browser-body">
                <div
                  className="replay-product-image"
                  role="img"
                  aria-label="Summit Trail 45L backpack"
                />
                <div className="replay-storefront-copy">
                  <small>{visualState.eyebrow}</small>
                  <h3 id="storefront-state-title">{visualState.title}</h3>
                  <strong>{visualState.value}</strong>
                  <p>{visualState.detail}</p>
                  {focusEvent?.type === 'warning' && (
                    <div className="storefront-warning">
                      <ShieldCheck size={13} />
                      Destination required before a reliable delivery estimate can be verified.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="storefront-evidence">
              <span className="mono">{focusEvent?.action ?? 'Observed browser state'}</span>
              <span>{focusEvent?.time}s</span>
            </div>
          </section>

          <section className="diagnosis-panel" aria-labelledby="diagnosis-title">
            <div className="investigation-section-heading">
              <span className="investigation-label">DIAGNOSIS</span>
              {focusEvent?.status && <StatusBadge dot={false}>{focusEvent.status}</StatusBadge>}
            </div>
            <h3 id="diagnosis-title">{focusEvent?.title}</h3>
            <dl>
              <div>
                <dt>Expected</dt>
                <dd>{diagnosis.expected}</dd>
              </div>
              <div>
                <dt>Observed</dt>
                <dd>{diagnosis.observed}</dd>
              </div>
              <div>
                <dt>Root cause</dt>
                <dd>{diagnosis.rootCause}</dd>
              </div>
              <div className="diagnosis-fix">
                <dt>Recommended fix</dt>
                <dd>{diagnosis.fix}</dd>
              </div>
            </dl>
            {focusEvent?.type === 'warning' && (
              <Link href="/recommendations#REC-004" className="text-link">
                Open remediation
                <ArrowRight size={13} />
              </Link>
            )}
          </section>
        </div>
      </Card>
      <div className="replay-layout">
        <Card className="replay-main">
          <CardHeader
            title="Full session trace"
            icon={
              <span className="section-icon">
                <Terminal size={15} />
              </span>
            }
            action={<span className="subtle-badge">{session.agent}</span>}
          />
          <div className="customer-goal">
            <span>
              <Target size={14} />
              CUSTOMER GOAL
            </span>
            <p>
              “
              {featured
                ? 'Find a hiking backpack under $250 suitable for a 3-day trip and purchase the best-rated option.'
                : session.goal}
              ”
            </p>
            <div>
              <span>
                <Wallet size={12} />
                {featured ? 'Budget ≤ $250' : session.goalType}
              </span>
              <span>
                <ShieldCheck size={12} />
                Intent recorded
              </span>
              <span>
                <span className="live-dot" />
                {session.environment}
              </span>
            </div>
          </div>
          <div className="replay-controls">
            <Tabs tabs={['Timeline', 'Requests', 'Agent context']} active={tab} onChange={setTab} />
            <div>
              <button
                aria-label="Reset replay"
                onClick={() => {
                  setPlaying(false);
                  setStep(0);
                }}
              >
                <RotateCcw size={13} />
              </button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (step >= events.length) setStep(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? <Pause size={12} /> : <Play size={12} />}
                {playing ? 'Pause' : 'Replay'}
              </Button>
            </div>
          </div>
          <div className="playback-track">
            <span style={{ width: `${(step / events.length) * 100}%` }} />
          </div>
          {tab === 'Timeline' ? (
            <AgentTimeline events={events} activeStep={step || focusEventId} />
          ) : tab === 'Requests' ? (
            <div className="request-list">
              {events
                .filter((e) => e.action)
                .map((e) => (
                  <div key={e.id}>
                    <span className="mono">{e.time}s</span>
                    <code>{e.action}</code>
                    <p>{e.details}</p>
                  </div>
                ))}
            </div>
          ) : (
            <div className="agent-context">
              <h3>Shopping session context</h3>
              <dl>
                <div>
                  <dt>Agent profile</dt>
                  <dd>{session.agent}</dd>
                </div>
                <div>
                  <dt>Intent reference</dt>
                  <dd className="mono">int_a7f92_{session.id.slice(-5)}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{session.environment}</dd>
                </div>
                <div>
                  <dt>Execution mode</dt>
                  <dd>Production-safe simulation</dd>
                </div>
                <div>
                  <dt>Goal type</dt>
                  <dd>{session.goalType}</dd>
                </div>
                <div>
                  <dt>Payment capture</dt>
                  <dd>Disabled</dd>
                </div>
              </dl>
              <div className="info-panel">
                <ShieldCheck size={17} />
                <span>
                  Decision summaries describe the agent’s observed choices and task constraints.
                </span>
              </div>
            </div>
          )}
          <div className="replay-complete">
            <Check size={14} />
            <span>
              {session.status === 'Completed'
                ? 'Session complete'
                : `Session ${session.status.toLowerCase()}`}
              <span>·</span>
              {session.steps} steps<span>·</span>
              {session.issues} {session.issues === 1 ? 'issue' : 'issues'} detected
            </span>
            <span className="mono">{session.duration}</span>
          </div>
        </Card>
        <div className="replay-sidebar">
          <Card>
            <CardHeader title="Security analysis" icon={<ShieldCheck size={16} />} />
            <div className="security-checks">
              {[
                { icon: Fingerprint, title: 'Verified agent identity', status: 'Verified' },
                {
                  icon: Target,
                  title: 'User intent',
                  status: session.status === 'Blocked' ? 'Enforced' : 'Verified',
                },
                { icon: Wallet, title: 'Spending limit', status: 'Within limit' },
                {
                  icon: ShoppingBag,
                  title: 'Order confirmation',
                  status: featured ? 'Needs attention' : 'Evaluated',
                },
              ].map((c) => (
                <div key={c.title}>
                  <c.icon size={15} />
                  <span>{c.title}</span>
                  <StatusBadge dot={false}>{c.status}</StatusBadge>
                </div>
              ))}
            </div>
            <div className="security-check-footer">
              <LockKeyhole size={11} />
              <span>Evaluated against merchant policy v1.4</span>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Merchant security policy"
              action={
                <Link href="/security" className="text-link">
                  Manage
                  <ArrowRight size={12} />
                </Link>
              }
            />
            {featured ? (
              <SecurityPolicyList />
            ) : (
              <div className="other-session-policy">
                <p>Policies were evaluated for the actions in this session.</p>
                <div>
                  <ShieldCheck size={16} />
                  <strong>
                    {session.status === 'Blocked'
                      ? 'Unsafe action blocked before execution'
                      : 'User intent preserved'}
                  </strong>
                </div>
                <Link href="/security" className="text-link">
                  Review policy configuration
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </Card>
          <div className="security-success">
            <span className="security-success-icon">
              <ShieldCheck size={23} />
            </span>
            <h3>
              {session.status === 'Blocked'
                ? 'Unsafe action stopped'
                : session.status === 'Failed'
                  ? 'Session remained contained'
                  : 'Safety controls held'}
            </h3>
            <p>
              {featured
                ? '1 potentially risky action was blocked. The agent stayed within the configured purchasing intent.'
                : session.status === 'Blocked'
                  ? 'The action was stopped before execution. No unauthorized purchase or modification was made.'
                  : 'No unauthorized actions were executed. Customer intent remained protected throughout the session.'}
            </p>
            <button onClick={() => setAllEvents(true)}>
              View all events
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="replay-note">
            <LockKeyhole size={13} />
            <p>This is a simulated shopping session. No live orders or payments were processed.</p>
          </div>
        </div>
      </div>
      <Dialog
        open={watchingReplay}
        onOpenChange={setWatchingReplay}
        title={`Visual replay · ${session.id}`}
        description="A recreation of the storefront driven by this session's recorded steps — not a screen recording, since the agent doesn't capture video."
      >
        <ReplayScreen event={currentEvent} />
        <div className="replay-controls">
          <span className="table-subtext">
            Step {Math.min(step, events.length)} of {events.length}
          </span>
          <div>
            <button
              aria-label="Reset replay"
              onClick={() => {
                setPlaying(false);
                setStep(0);
              }}
            >
              <RotateCcw size={13} />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (step >= events.length) setStep(0);
                setPlaying((playing) => !playing);
              }}
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
              {playing ? 'Pause' : 'Play'}
            </Button>
          </div>
        </div>
        <div className="playback-track">
          <span style={{ width: `${(step / events.length) * 100}%` }} />
        </div>
      </Dialog>
      <Dialog
        open={allEvents}
        onOpenChange={setAllEvents}
        title={`Security events · ${session.id}`}
        description="Policy decisions captured during this shopping session."
      >
        <div className="event-dialog-list">
          {events
            .filter((e) => ['warning', 'promo', 'goal', 'complete'].includes(e.type))
            .map((e) => (
              <div key={e.id}>
                <span className="mono">{e.time}s</span>
                <div>
                  <strong>{e.title}</strong>
                  <p>{e.details}</p>
                </div>
              </div>
            ))}
        </div>
      </Dialog>
    </>
  );
}

function getReplayVisualState(eventId: number) {
  if (eventId <= 2)
    return {
      context: 'Catalog',
      eyebrow: 'BACKPACK COLLECTION',
      title: '3 relevant products',
      value: '$129–$259',
      detail:
        'The agent can see ratings, prices, and basic product metadata before narrowing the set.',
    };
  if (eventId <= 4)
    return {
      context: eventId === 4 ? 'Shipping policy' : 'Product',
      eyebrow: 'SUMMIT TRAIL 45L · FOREST',
      title: eventId === 4 ? 'Shipping: 3–5 business days' : 'Summit Trail 45L',
      value: '$199 · 4.9/5',
      detail:
        eventId === 4
          ? 'The storefront returns a generic delivery window before collecting a destination.'
          : 'Selected because it is within budget, highest rated, and sized for a 3-day trip.',
    };
  if (eventId <= 6)
    return {
      context: 'Cart',
      eyebrow: 'CART · 1 ITEM',
      title: 'Summit Trail 45L',
      value: '$199.00',
      detail:
        eventId === 6
          ? 'WELCOME10 was rejected and an unrequested retry was prevented by policy.'
          : 'The selected backpack was added successfully with quantity and price preserved.',
    };
  return {
    context: 'Checkout',
    eyebrow: 'ORDER SUMMARY',
    title: 'Simulation total',
    value: '$214.92',
    detail:
      eventId === 8
        ? 'The simulated order completed without capturing payment or creating a live order.'
        : 'Checkout remains within the customer’s $250 spending limit. Payment capture is disabled.',
  };
}

function getReplayDiagnosis(event?: ReturnType<typeof getSessionEvents>[number]) {
  if (!event) return { expected: '', observed: '', rootCause: '', fix: '' };
  if (event.type === 'warning')
    return {
      expected: 'A destination-aware delivery estimate before the agent relies on shipping timing.',
      observed:
        'The storefront returned “3–5 business days” without first collecting a destination.',
      rootCause:
        'Shipping policy data is not conditioned on destination, so delivery eligibility cannot be verified.',
      fix: 'Require a destination before returning delivery timing, then expose the resulting estimate in machine-readable policy data.',
    };
  if (event.type === 'promo')
    return {
      expected: 'Apply only promotions authorized by the shopper’s intent and merchant policy.',
      observed: event.summary,
      rootCause:
        'The promotion was ineligible; the policy layer correctly prevented an unrequested retry.',
      fix: 'No remediation required. Preserve the current control and keep the decision in the audit trace.',
    };
  return {
    expected: 'The agent completes this step within the customer goal and merchant policy.',
    observed: event.summary,
    rootCause: 'No merchant-side failure was detected at this step.',
    fix: 'No remediation required. Continue to the next journey step.',
  };
}
